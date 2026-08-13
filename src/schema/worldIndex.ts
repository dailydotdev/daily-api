import { IResolvers } from '@graphql-tools/utils';
import graphorm from '../graphorm';
import { subDays } from 'date-fns';
import type { EntityManager } from 'typeorm';
import type { AuthContext, BaseContext, Context } from '../Context';
import type { GQLUser } from './users';
import { Niche } from '../entity/Niche';
import { User } from '../entity/user/User';
import { UserNicheAnalytics } from '../entity/user/UserNicheAnalytics';
import { UserNicheGrowth } from '../entity/user/UserNicheGrowth';
import {
  UserNicheRank,
  UserNicheRankPeriod,
} from '../entity/user/UserNicheRank';
import { UserWorldLevelUp } from '../entity/user/UserWorldLevelUp';
import {
  UserWorldSummary,
  type UserWorldSummaryTopNiche,
} from '../entity/user/UserWorldSummary';
import { UserWorldSettings } from '../entity/user/UserWorldSettings';
import { districtLevelOf } from '../common/worldLadder';
import {
  applyWorldIndexPrivacy,
  WORLD_INDEX_SECTION_LIMIT,
  WORLD_LEVEL_UP_WINDOW_HOURS,
  WORLD_RANK_DEPTH,
  WORLD_RANK_MAX_LIMIT,
  WORLD_RANK_WEEK_DAYS,
} from '../common/worldIndex';
import { getLimit } from '../common';
import { queryReadReplica } from '../common/queryReadReplica';
import {
  worldDomainRankingSchema,
  worldDomainRankPositionSchema,
  worldIndexSectionSchema,
  worldTopicRankingSchema,
  worldTopicRankPositionSchema,
  worldTopicReadersSchema,
} from '../common/schema/worldIndex';
import { UserDomainRank } from '../entity/user/UserDomainRank';
import { ContentPreferenceStatus } from '../entity/contentPreference/types';

export type GQLWorldTopic = {
  niche: Niche;
  articles: number;
  level: number;
};

export type GQLIndexedWorld = {
  user: GQLUser;
  name: string | null;
  topics: number;
  articles: number;
  topTopics: GQLWorldTopic[];
};

export type GQLWorldRankEntry = {
  rank: number;
  user: GQLUser;
  worldName: string | null;
  articles: number;
  level: number;
};

export type GQLWorldRankPosition = {
  rank: number | null;
  articles: number;
  level: number;
  cappedAt: number;
};

export type GQLWorldTopicReaders = {
  niche: Niche;
  readers: number;
};

export type GQLWorldDomainRankEntry = {
  rank: number;
  user: GQLUser;
  worldName: string | null;
  articles: number;
};

export type GQLWorldDomainReaders = {
  domain: string;
  readers: number;
};

export type GQLWorldLevelUp = {
  world: GQLIndexedWorld;
  niche: Niche;
  level: number;
  createdAt: Date;
};

export const typeDefs = /* GraphQL */ `
  """
  The window a topic's ranking is scored over. The two are the same readers
  scored differently, and the gap between them is the point: a week is winnable,
  all time is largely a record of who started earliest
  """
  enum WorldRankPeriod {
    week
    all
  }

  """
  One topic inside a world, at the size the reading made it
  """
  type WorldTopic {
    """
    The topic itself
    """
    niche: Niche!
    """
    Articles read in this topic
    """
    articles: Int!
    """
    Rung on the twelve-step ladder, 0 for ground nobody has touched
    """
    level: Int!
  }

  """
  A world as the index lists it. Never a private world, and never one holding
  fewer topics than the index's floor
  """
  type IndexedWorld {
    """
    Whose world it is
    """
    user: User!
    """
    What the owner calls the place, or null when nobody has named it
    """
    name: String
    """
    Topics the world holds
    """
    topics: Int!
    """
    Articles read across every topic
    """
    articles: Int!
    """
    The largest topics, biggest first, what a card is actually about
    """
    topTopics: [WorldTopic!]!
  }

  """
  One row of a topic's ranking
  """
  type WorldRankEntry {
    """
    Placing inside the topic, best first
    """
    rank: Int!
    """
    The reader
    """
    user: User!
    """
    What the owner calls their world, or null when nobody has named it
    """
    worldName: String
    """
    Articles read in this topic inside the period
    """
    articles: Int!
    """
    Rung the reader's district sits on. Always the lifetime rung, on both
    periods, a week's reading is a rate, and a rate has no rung
    """
    level: Int!
  }

  """
  Where the viewer stands in one topic, resolvable whether or not they appear
  in the ranking itself
  """
  type WorldRankPosition {
    """
    Placing, or null when the viewer ranks beyond cappedAt, has not read the
    topic, or holds a world the index does not list
    """
    rank: Int
    """
    Articles the viewer read in this topic inside the period. Real even when
    the placing is null
    """
    articles: Int!
    """
    The viewer's lifetime rung in this topic
    """
    level: Int!
    """
    The deepest placing the ranking states; beyond it rank is null
    """
    cappedAt: Int!
  }

  """
  A field of reading, one step up from a topic. Six of them cover the taxonomy
  """
  enum NicheDomain {
    ai
    web
    systems
    cloud
    security
    craft
  }

  """
  One row of a domain's ranking. No level: a rung belongs to a single topic,
  and a total across a domain sits on none of them
  """
  type WorldDomainRankEntry {
    """
    Placing inside the domain, best first
    """
    rank: Int!
    """
    The reader
    """
    user: User!
    """
    What the owner calls their world, or null when nobody has named it
    """
    worldName: String
    """
    Articles read across the whole domain inside the period
    """
    articles: Int!
  }

  """
  How many listed worlds have read anything in a domain. Counted once per
  reader, not summed over the domain's topics
  """
  type WorldDomainReaders {
    """
    The domain
    """
    domain: NicheDomain!
    """
    Listed worlds that have read anything in it
    """
    readers: Int!
  }

  """
  How many listed worlds have read a topic at all
  """
  type WorldTopicReaders {
    """
    The topic
    """
    niche: Niche!
    """
    Listed worlds holding a district in this topic
    """
    readers: Int!
  }

  """
  A world whose district cleared a rung
  """
  type WorldLevelUp {
    """
    The world it happened to
    """
    world: IndexedWorld!
    """
    The topic that crossed
    """
    niche: Niche!
    """
    The rung it reached
    """
    level: Int!
    """
    When the crossing was recorded
    """
    createdAt: DateTime!
  }

  extend type Query {
    """
    One topic's ranking, best first. Private worlds and worlds below the index's
    topic floor never appear
    """
    worldTopicRanking(
      """
      The topic to rank
      """
      nicheId: ID!
      """
      Which window to score over
      """
      period: WorldRankPeriod!
      """
      Rows to return
      """
      limit: Int
    ): [WorldRankEntry!]! @cacheControl(maxAge: 600)

    """
    Where the viewer stands in one topic
    """
    worldTopicRankPosition(
      """
      The topic to place the viewer in
      """
      nicheId: ID!
      """
      Which window to score over
      """
      period: WorldRankPeriod!
    ): WorldRankPosition! @auth

    """
    How many listed worlds have read each topic. Every topic when no ids are
    given
    """
    worldTopicReaders(
      """
      Topics to count, or all of them
      """
      nicheIds: [ID!]
    ): [WorldTopicReaders!]! @cacheControl(maxAge: 600)

    """
    One domain's ranking, best first. Aggregated across the domain's topics
    before any depth cap, so a broad reader places where a per-topic board
    would never show them
    """
    worldDomainRanking(
      """
      The domain to rank
      """
      domain: NicheDomain!
      """
      Which window to score over
      """
      period: WorldRankPeriod!
      """
      Rows to return
      """
      limit: Int
    ): [WorldDomainRankEntry!]! @cacheControl(maxAge: 600)

    """
    Where the viewer stands in one domain
    """
    worldDomainRankPosition(
      """
      The domain to place the viewer in
      """
      domain: NicheDomain!
      """
      Which window to score over
      """
      period: WorldRankPeriod!
    ): WorldRankPosition! @auth

    """
    How many listed worlds have read each domain
    """
    worldDomainReaders: [WorldDomainReaders!]! @cacheControl(maxAge: 600)

    """
    Worlds whose district cleared a rung in roughly the last day
    """
    worldRecentLevelUps(
      """
      Worlds to return
      """
      limit: Int
    ): [WorldLevelUp!]! @cacheControl(maxAge: 600)

    """
    Worlds belonging to the people the viewer follows, and to everyone they
    share a squad with
    """
    followedWorlds(
      """
      Worlds to return
      """
      limit: Int
    ): [IndexedWorld!]! @auth
  }
`;

/**
 * What a summary row looks like once it is joined to its owner.
 *
 * The user columns arrive flat, as `u.*`, which is the shape every other
 * leaderboard in the API returns a user in.
 */
type RawIndexedWorld = User & {
  worldName: string | null;
  topics: number;
  articles: number;
  topNiches: UserWorldSummaryTopNiche[];
};

/**
 * The summary columns, joined to the owner and to whatever they named the
 * place, with private worlds excluded live.
 *
 * `user_world_summary` already holds only public worlds, but it is rebuilt
 * nightly, this is what stops a world listed yesterday from surviving its
 * owner making it private this morning.
 */
const indexedWorldQuery = (manager: EntityManager) =>
  applyWorldIndexPrivacy(
    manager
      .createQueryBuilder()
      .from(UserWorldSummary, 'w')
      .select('u.*')
      .addSelect('w.districts', 'topics')
      .addSelect('w.reads', 'articles')
      .addSelect('w."topNiches"', 'topNiches')
      .addSelect('s.name', 'worldName')
      .innerJoin(User, 'u', 'u.id = w."userId"')
      .leftJoin(UserWorldSettings, 's', 's."userId" = w."userId"'),
    'w."userId"',
  );

/**
 * Hydrate the topics named on a set of summaries.
 *
 * Summaries store niche ids rather than titles, because a retitled niche would
 * otherwise stay wrong until the next rebuild. One lookup covers every world in
 * the response, the alternative is a query per card.
 */
const withTopTopics = async (
  manager: EntityManager,
  rows: RawIndexedWorld[],
): Promise<GQLIndexedWorld[]> => {
  const nicheIds = [
    ...new Set(rows.flatMap((row) => row.topNiches.map((top) => top.nicheId))),
  ];
  const niches = nicheIds.length
    ? await manager.getRepository(Niche).findByIds(nicheIds)
    : [];
  const byId = new Map(niches.map((niche) => [niche.id, niche]));

  return rows.map(({ worldName, topics, articles, topNiches, ...user }) => ({
    user,
    name: worldName,
    topics,
    articles,
    topTopics: topNiches.flatMap<GQLWorldTopic>((top) => {
      const niche = byId.get(top.nicheId);

      // A niche deleted between the rebuild and now costs the card a topic
      // rather than the whole response.
      if (!niche) {
        return [];
      }

      return [
        { niche, articles: top.reads, level: districtLevelOf(top.reads) },
      ];
    }),
  }));
};

/**
 * The viewer's own reads in a topic, when the ranking does not hold them.
 *
 * Both branches are keyed on the viewer, which is the direction the world
 * tables are built for: the districts table is a point lookup on its primary
 * key, and a week of one reader's growth is a range scan on the front of the
 * growth log's. Neither is the expensive question, that is ranking them
 * against everybody, which is what the materialisation already answered.
 */
const viewerArticles = async ({
  manager,
  userId,
  nicheId,
  period,
}: {
  manager: EntityManager;
  userId: string;
  nicheId: string;
  period: UserNicheRankPeriod;
}): Promise<{ articles: number; lifetime: number }> => {
  const district = await manager
    .getRepository(UserNicheAnalytics)
    .findOne({ where: { userId, nicheId }, select: ['reads'] });
  const lifetime = district?.reads ?? 0;

  if (period === UserNicheRankPeriod.All) {
    return { articles: lifetime, lifetime };
  }

  const since = subDays(new Date(), WORLD_RANK_WEEK_DAYS)
    .toISOString()
    .slice(0, 10);
  const week = await manager
    .createQueryBuilder()
    .from(UserNicheGrowth, 'g')
    .select('COALESCE(SUM(g.reads), 0)::int', 'reads')
    .where('g."userId" = :userId', { userId })
    .andWhere('g."nicheId" = :nicheId', { nicheId })
    .andWhere('g.date >= :since', { since })
    .getRawOne<{ reads: number }>();

  return { articles: week?.reads ?? 0, lifetime };
};

/**
 * The viewer's own total across a domain, when the ranking does not hold them.
 *
 * Keyed on the viewer, which is the direction the world tables are built for:
 * their districts are a range scan on the front of a primary key. Ranking that
 * total against everybody is the expensive half, and the view already answered
 * it.
 */
const domainArticles = async ({
  manager,
  userId,
  domain,
  period,
}: {
  manager: EntityManager;
  userId: string;
  domain: string;
  period: UserNicheRankPeriod;
}): Promise<number> => {
  if (period === UserNicheRankPeriod.All) {
    const total = await manager
      .createQueryBuilder()
      .from(UserNicheAnalytics, 'd')
      .select('COALESCE(SUM(d.reads), 0)::int', 'reads')
      .innerJoin(Niche, 'n', 'n.id = d."nicheId"')
      .where('d."userId" = :userId', { userId })
      .andWhere('n.domain = :domain', { domain })
      .getRawOne<{ reads: number }>();

    return total?.reads ?? 0;
  }

  const since = subDays(new Date(), WORLD_RANK_WEEK_DAYS)
    .toISOString()
    .slice(0, 10);
  const week = await manager
    .createQueryBuilder()
    .from(UserNicheGrowth, 'g')
    .select('COALESCE(SUM(g.reads), 0)::int', 'reads')
    .innerJoin(Niche, 'n', 'n.id = g."nicheId"')
    .where('g."userId" = :userId', { userId })
    .andWhere('n.domain = :domain', { domain })
    .andWhere('g.date >= :since', { since })
    .getRawOne<{ reads: number }>();

  return week?.reads ?? 0;
};

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    worldTopicRanking: async (
      _,
      args,
      ctx: Context,
      info,
    ): Promise<GQLWorldRankEntry[]> => {
      const { nicheId, period, limit } = worldTopicRankingSchema.parse(args);

      return graphorm.query<GQLWorldRankEntry>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = applyWorldIndexPrivacy(
            builder.queryBuilder
              // The ranking is rebuilt from the summary in the same refresh, so
              // this join is redundant on a healthy one, and is what holds the
              // floor if a refresh ever lands half-applied.
              .innerJoin(
                UserWorldSummary,
                'w',
                `w."userId" = "${builder.alias}"."userId"`,
              )
              .where(`"${builder.alias}"."nicheId" = :nicheId`, { nicheId })
              .andWhere(`"${builder.alias}"."period" = :period`, { period }),
            `"${builder.alias}"."userId"`,
          )
            // Matches the order the ranking was materialised in, so the placing
            // a row is shown at is the placing it was given.
            .orderBy(`"${builder.alias}"."reads"`, 'DESC')
            .addOrderBy(`"${builder.alias}"."userId"`, 'ASC')
            .limit(
              getLimit({
                limit: limit as number,
                defaultLimit: 10,
                max: WORLD_RANK_MAX_LIMIT,
              }),
            );

          return builder;
        },
        true,
      );
    },

    /**
     * The viewer's placing, which the ranking's own page will usually not
     * contain, the page is eleven rows and the ranking is a thousand.
     *
     * Two shapes, mirroring `leaderboardPosition`. Inside the materialised
     * depth the placing is a count of the rows above the viewer, bounded by
     * that depth. Outside it there is no honest placing to state, so `rank` is
     * null while `articles` and `level` are still answered from the viewer's
     * own rows, being unranked is not the same as having read nothing.
     */
    worldTopicRankPosition: async (
      _,
      args,
      ctx: AuthContext,
    ): Promise<GQLWorldRankPosition> => {
      const { nicheId, period } = worldTopicRankPositionSchema.parse(args);
      const { userId } = ctx;

      return queryReadReplica(ctx.con, async ({ queryRunner }) => {
        const { manager } = queryRunner;
        const own = await manager.getRepository(UserNicheRank).findOne({
          where: { nicheId, period, userId },
          select: ['reads', 'lifetimeReads'],
        });

        if (!own) {
          const { articles, lifetime } = await viewerArticles({
            manager,
            userId,
            nicheId,
            period,
          });

          return {
            rank: null,
            articles,
            level: districtLevelOf(lifetime),
            cappedAt: WORLD_RANK_DEPTH,
          };
        }

        // Strict `>`, so readers tied on the same count share the best placing
        // between them rather than being split on an arbitrary tiebreak.
        const outranking = await applyWorldIndexPrivacy(
          manager
            .createQueryBuilder()
            .from(UserNicheRank, 'r')
            .select('COUNT(1)::int', 'count')
            .where('r."nicheId" = :nicheId', { nicheId })
            .andWhere('r.period = :period', { period })
            .andWhere('r.reads > :reads', { reads: own.reads }),
          'r."userId"',
        ).getRawOne<{ count: number }>();

        return {
          rank: (outranking?.count ?? 0) + 1,
          articles: own.reads,
          level: districtLevelOf(own.lifetimeReads),
          cappedAt: WORLD_RANK_DEPTH,
        };
      });
    },

    worldDomainRanking: async (
      _,
      args,
      ctx: Context,
      info,
    ): Promise<GQLWorldDomainRankEntry[]> => {
      const { domain, period, limit } = worldDomainRankingSchema.parse(args);

      return graphorm.query<GQLWorldDomainRankEntry>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = applyWorldIndexPrivacy(
            builder.queryBuilder
              .innerJoin(
                UserWorldSummary,
                'w',
                `w."userId" = "${builder.alias}"."userId"`,
              )
              .where(`"${builder.alias}"."domain" = :domain`, { domain })
              .andWhere(`"${builder.alias}"."period" = :period`, { period }),
            `"${builder.alias}"."userId"`,
          )
            .orderBy(`"${builder.alias}"."reads"`, 'DESC')
            .addOrderBy(`"${builder.alias}"."userId"`, 'ASC')
            .limit(
              getLimit({
                limit: limit as number,
                defaultLimit: 10,
                max: WORLD_RANK_MAX_LIMIT,
              }),
            );

          return builder;
        },
        true,
      );
    },

    /**
     * The viewer's placing in a domain.
     *
     * `level` is always 0 here. A rung belongs to one district on the ladder,
     * and a total across a domain sits on none of them, so the field is
     * answered rather than guessed at. `articles` is the real total either way.
     */
    worldDomainRankPosition: async (
      _,
      args,
      ctx: AuthContext,
    ): Promise<GQLWorldRankPosition> => {
      const { domain, period } = worldDomainRankPositionSchema.parse(args);
      const { userId } = ctx;

      return queryReadReplica(ctx.con, async ({ queryRunner }) => {
        const { manager } = queryRunner;
        const own = await manager
          .getRepository(UserDomainRank)
          .findOne({ where: { domain, period, userId }, select: ['reads'] });

        if (!own) {
          return {
            rank: null,
            articles: await domainArticles({ manager, userId, domain, period }),
            level: 0,
            cappedAt: WORLD_RANK_DEPTH,
          };
        }

        // Strict `>`, so readers tied on a count share the best placing between
        // them rather than being split on an arbitrary tiebreak.
        const outranking = await applyWorldIndexPrivacy(
          manager
            .createQueryBuilder()
            .from(UserDomainRank, 'r')
            .select('COUNT(1)::int', 'count')
            .where('r."domain" = :domain', { domain })
            .andWhere('r.period = :period', { period })
            .andWhere('r.reads > :reads', { reads: own.reads }),
          'r."userId"',
        ).getRawOne<{ count: number }>();

        return {
          rank: (outranking?.count ?? 0) + 1,
          articles: own.reads,
          level: 0,
          cappedAt: WORLD_RANK_DEPTH,
        };
      });
    },

    worldDomainReaders: async (
      _,
      args,
      ctx: Context,
      info,
    ): Promise<GQLWorldDomainReaders[]> => {
      return graphorm.query<GQLWorldDomainReaders>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.orderBy(`"${builder.alias}"."readers"`, 'DESC');

          return builder;
        },
        true,
      );
    },

    worldTopicReaders: async (
      _,
      args,
      ctx: Context,
      info,
    ): Promise<GQLWorldTopicReaders[]> => {
      const { nicheIds } = worldTopicReadersSchema.parse(args);

      return graphorm.query<GQLWorldTopicReaders>(
        ctx,
        info,
        (builder) => {
          if (nicheIds?.length) {
            builder.queryBuilder.where(
              `"${builder.alias}"."nicheId" IN (:...nicheIds)`,
              { nicheIds },
            );
          }

          builder.queryBuilder.orderBy(`"${builder.alias}"."readers"`, 'DESC');

          return builder;
        },
        true,
      );
    },

    /**
     * Worlds that cleared a rung in roughly the last day.
     *
     * One row per world, the biggest rung it reached, because a reader who
     * crossed in four districts at once is one thing that happened, not four.
     *
     * Ordered smallest world first. The skew towards small worlds is not the
     * ordering's doing: the ladder doubles, so a world of three districts
     * crosses a rung most weeks while a long-tenured one may go a year between
     * crossings. The ordering only declines to hide it.
     */
    worldRecentLevelUps: async (
      _,
      args,
      ctx: Context,
    ): Promise<GQLWorldLevelUp[]> => {
      const { limit } = worldIndexSectionSchema.parse(args);
      const rows = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        applyWorldIndexPrivacy(
          queryRunner.manager
            .createQueryBuilder()
            .from(UserWorldLevelUp, 'l')
            // One row per world, so the SELECT list has to lead with the
            // deduplicated column, which is the builder's job, not a string's.
            .distinctOn(['l."userId"'])
            .select('l."userId"', 'userId')
            .addSelect('l."nicheId"', 'nicheId')
            .addSelect('l.level', 'level')
            .addSelect('l."createdAt"', 'createdAt')
            .addSelect('w.reads', 'worldReads')
            .innerJoin(UserWorldSummary, 'w', 'w."userId" = l."userId"')
            .where(`l."createdAt" >= now() - (:hours || ' hours')::interval`, {
              hours: WORLD_LEVEL_UP_WINDOW_HOURS,
            }),
          'l."userId"',
        )
          // DISTINCT ON needs the deduplicated column to lead; the rest picks
          // the biggest rung the world reached in the window.
          .orderBy('l."userId"', 'ASC')
          .addOrderBy('l.level', 'DESC')
          .getRawMany<{
            userId: string;
            nicheId: string;
            level: number;
            createdAt: Date;
            worldReads: number;
          }>(),
      );

      const picked = rows
        .sort((a, b) => a.worldReads - b.worldReads || b.level - a.level)
        .slice(
          0,
          getLimit({
            limit: limit as number,
            defaultLimit: WORLD_INDEX_SECTION_LIMIT,
            max: WORLD_RANK_MAX_LIMIT,
          }),
        );

      if (!picked.length) {
        return [];
      }

      return queryReadReplica(ctx.con, async ({ queryRunner }) => {
        const { manager } = queryRunner;
        const [worlds, niches] = await Promise.all([
          indexedWorldQuery(manager)
            .andWhere('w."userId" IN (:...userIds)', {
              userIds: picked.map((row) => row.userId),
            })
            .getRawMany<RawIndexedWorld>()
            .then((rawWorlds) => withTopTopics(manager, rawWorlds)),
          manager
            .getRepository(Niche)
            .findByIds([...new Set(picked.map((row) => row.nicheId))]),
        ]);

        const worldByUser = new Map(
          worlds.map((world) => [world.user.id, world]),
        );
        const nicheById = new Map(niches.map((niche) => [niche.id, niche]));

        return picked.flatMap<GQLWorldLevelUp>((row) => {
          const world = worldByUser.get(row.userId);
          const niche = nicheById.get(row.nicheId);

          // Either can vanish between the two reads, a world made private, a
          // niche retired. Dropping the entry is the only safe answer.
          if (!world || !niche) {
            return [];
          }

          return [{ world, niche, level: row.level, createdAt: row.createdAt }];
        });
      });
    },

    /**
     * The worlds of people the viewer follows.
     *
     * Follows only. Sharing a squad is not a statement about a person the way
     * following one is: a large squad would flood the section with people the
     * viewer never chose, and drown the handful they did.
     *
     * The candidates are a semi-join rather than a fetched id list, since a
     * follow list runs to thousands and does not need to travel to Node to be
     * intersected with the worlds worth listing.
     */
    followedWorlds: async (
      _,
      args,
      ctx: AuthContext,
    ): Promise<GQLIndexedWorld[]> => {
      const { limit } = worldIndexSectionSchema.parse(args);
      const { userId } = ctx;

      return queryReadReplica(ctx.con, async ({ queryRunner }) => {
        const { manager } = queryRunner;
        const rows = await indexedWorldQuery(manager)
          .andWhere('w."userId" != :userId', { userId })
          .andWhere(
            /* sql */ `w."userId" IN (
              SELECT cp."referenceId" FROM content_preference cp
              WHERE cp."userId" = :userId
                AND cp.type = 'user'
                AND cp.status IN (:...followStatuses)
                AND cp."feedId" = :userId
            )`,
            {
              userId,
              followStatuses: [
                ContentPreferenceStatus.Follow,
                ContentPreferenceStatus.Subscribed,
              ],
            },
          )
          .orderBy('w.reads', 'DESC')
          .addOrderBy('w."userId"', 'ASC')
          .limit(
            getLimit({
              limit: limit as number,
              defaultLimit: WORLD_INDEX_SECTION_LIMIT,
              max: WORLD_RANK_MAX_LIMIT,
            }),
          )
          .getRawMany<RawIndexedWorld>();

        return withTopTopics(manager, rows);
      });
    },
  },
};
