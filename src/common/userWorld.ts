import type {
  DataSource,
  EntityManager,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { UserWorldSettings } from '../entity/user/UserWorldSettings';
import { UserNicheAnalytics } from '../entity/user/UserNicheAnalytics';
import { Niche } from '../entity/Niche';
import { SERVING_HIDDEN_NICHE_SLUGS } from './clickhouse/worldRules';
import { type CrestDistrict, defaultCrest } from './worldCatalogue';
import { DEFAULT_LOOK, DEFAULT_SKY } from './worldStyle';
import { User } from '../entity/user/User';

/**
 * Whether `viewerId` is allowed to see `ownerId`'s world at all.
 *
 * Private is not a per-surface policy — it covers the world, the timeline and
 * the crest together, so this is the only gate and every read path calls it.
 * An anonymous viewer has no id and can never be the owner.
 */
export const canViewWorld = ({
  viewerId,
  ownerId,
  settings,
}: {
  viewerId: string | undefined;
  ownerId: string;
  settings: Pick<UserWorldSettings, 'private'> | null;
}): boolean => !settings?.private || viewerId === ownerId;

/**
 * The same gate as `canViewWorld`, folded into a query that is already running.
 *
 * A private world is not an error, it is an empty one — so this is a predicate
 * rather than a thrown error, and the owner's own read skips it entirely rather
 * than paying for a subquery that can only ever be true.
 */
export const applyWorldPrivacy = ({
  builder,
  ownerId,
  viewerId,
}: {
  builder: { queryBuilder: SelectQueryBuilder<ObjectLiteral> };
  ownerId: string;
  viewerId: string | undefined;
}): void => {
  if (viewerId === ownerId) {
    return;
  }
  builder.queryBuilder = builder.queryBuilder.andWhere(
    `NOT EXISTS (SELECT 1 FROM user_world_settings s WHERE s."userId" = :worldOwnerId AND s.private = true)`,
    { worldOwnerId: ownerId },
  );
};

export const getWorldSettings = (
  con: DataSource | EntityManager,
  userId: string,
): Promise<UserWorldSettings | null> =>
  con.getRepository(UserWorldSettings).findOneBy({ userId });

/** Only what the default world name is built from. */
export const getWorldOwner = (
  con: DataSource | EntityManager,
  userId: string,
): Promise<Pick<User, 'name' | 'username'> | null> =>
  con
    .getRepository(User)
    .findOne({ where: { id: userId }, select: ['name', 'username'] });

/**
 * The user's districts as the crest rules see them, largest first and with the
 * niches that are hidden at serving left out — a crest cannot be built out of a
 * district the world does not draw.
 */
export const getCrestDistricts = async (
  con: DataSource | EntityManager,
  userId: string,
): Promise<CrestDistrict[]> => {
  const rows = await con
    .getRepository(UserNicheAnalytics)
    .createQueryBuilder('una')
    // Both columns are aliased explicitly so the raw keys are exactly these,
    // rather than the "{alias}_{property}" form an entity select would produce.
    .select('niche.slug', 'slug')
    .addSelect('una.reads', 'reads')
    .innerJoin(Niche, 'niche', 'niche.id = una."nicheId"')
    .where('una."userId" = :userId', { userId })
    .andWhere('niche.slug NOT IN (:...hidden)', {
      hidden: [...SERVING_HIDDEN_NICHE_SLUGS],
    })
    .orderBy('una.reads', 'DESC')
    .getRawMany<{ slug: string; reads: number }>();

  return rows;
};

/**
 * What an unnamed world is called.
 *
 * Derived on the server rather than left to the client, because a world is meant
 * to be recognised by strangers and two clients inventing two different names
 * for the same place defeats that. Deterministic for the same reason: the same
 * world answers with the same name everywhere it appears.
 */
export const defaultWorldName = (
  user: Pick<User, 'name' | 'username'> | null,
): string => `${user?.name || user?.username || 'a developer'}'s world`;

/**
 * What the serving layer answers with. A user who has never opened the panel has
 * no row, so the suggestions are derived per request rather than written out
 * once — a stored copy would freeze whatever the world looked like on the day
 * the row happened to appear.
 *
 * `districts` is what the derived crest is built from, and is carried on the
 * result so the entitlements field can reuse it instead of asking again.
 */
export const resolveWorldSettings = ({
  userId,
  settings,
  districts,
  user,
}: {
  userId: string;
  settings: UserWorldSettings | null;
  districts: CrestDistrict[];
  user: Pick<User, 'name' | 'username'> | null;
}) => ({
  userId,
  districts,
  name: settings?.name ?? defaultWorldName(user),
  sky: settings?.sky ?? DEFAULT_SKY,
  crest: settings?.crest ?? defaultCrest({ userId, districts }),
  look: settings?.look ?? DEFAULT_LOOK,
  private: settings?.private ?? false,
});
