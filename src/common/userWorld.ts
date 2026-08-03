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
import {
  type CrestDistrict,
  defaultCrest,
  earnedCharges,
  earnedTinctures,
} from './worldCrest';
import { DEFAULT_LOOK, DEFAULT_SKY } from './worldStyle';

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
    .select(['una.reads'])
    .addSelect('niche.slug', 'slug')
    .innerJoin(Niche, 'niche', 'niche.id = una."nicheId"')
    .where('una."userId" = :userId', { userId })
    .andWhere('niche.slug NOT IN (:...hidden)', {
      hidden: [...SERVING_HIDDEN_NICHE_SLUGS],
    })
    .orderBy('una.reads', 'DESC')
    .getRawMany<{ slug: string; una_reads: number }>();

  return rows.map(({ slug, una_reads }) => ({ slug, reads: una_reads }));
};

/**
 * Reject a crest the user has not earned.
 *
 * The division is not checked because a division encodes nothing — it is the
 * one axis where taste is allowed to be taste. Everything else has to come out
 * of the reading, which is the whole reason the mark is worth flying.
 */
export const assertCrestEarned = ({
  crest,
  districts,
}: {
  crest: { charge: string; a: number; b: number };
  districts: CrestDistrict[];
}): string | null => {
  if (!earnedCharges(districts).includes(crest.charge)) {
    return `charge "${crest.charge}" has not been earned`;
  }
  const tinctures = earnedTinctures(districts);
  for (const [key, colour] of [
    ['a', crest.a],
    ['b', crest.b],
  ] as const) {
    if (!tinctures.includes(colour)) {
      return `tincture "${key}" is not an accent of any founded district`;
    }
  }
  return null;
};

/**
 * What the serving layer answers with. A user who has never opened the panel
 * has no row, so the suggestions are derived per request rather than written
 * out once — a stored copy would freeze whatever the world looked like on the
 * day the row happened to appear.
 */
export const resolveWorldSettings = ({
  userId,
  settings,
  districts,
}: {
  userId: string;
  settings: UserWorldSettings | null;
  districts: CrestDistrict[];
}) => ({
  name: settings?.name ?? null,
  sky: settings?.sky ?? DEFAULT_SKY,
  crest: settings?.crest ?? defaultCrest({ userId, districts }),
  look: settings?.look ?? DEFAULT_LOOK,
  private: settings?.private ?? false,
  availableCharges: earnedCharges(districts),
  availableTinctures: earnedTinctures(districts),
});
