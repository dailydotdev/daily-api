import { subDays } from 'date-fns';
import type { EntityManager } from 'typeorm';
import type { Cron } from './cron';
import { SERVING_HIDDEN_NICHE_SLUGS } from '../common/clickhouse/worldRules';
import {
  WORLD_INDEX_MIN_DISTRICTS,
  WORLD_INDEX_TOP_NICHES,
  WORLD_LEVEL_UP_RETENTION_DAYS,
  WORLD_RANK_DEPTH,
  WORLD_RANK_WEEK_DAYS,
} from '../common/worldIndex';
import { UserNicheRankPeriod } from '../entity/user/UserNicheRank';

/**
 * Everything the world index reads from, rebuilt nightly.
 *
 * Ranking readers against each other is the whole cost of this feature, and
 * none of it can be paid per request. All time would need `user_niche_analytics`
 * scanned by `nicheId`, the reverse of its primary key, which leads with
 * `userId` because that is how a single world is read, and a week would need
 * `user_niche_growth`, the largest table the feature has, aggregated across
 * every reader of the topic before the first row could come back. Both are the
 * same answer for every visitor, so both are computed once.
 *
 * Each table is rebuilt whole rather than maintained, because there is no
 * cheap incremental form: one reader's day of reading moves everybody below
 * them in that topic. What makes a whole rebuild affordable is the depth cap:
 * the rankings hold the top `WORLD_RANK_DEPTH` of each (topic, period) rather
 * than every reader, so they stay in the hundreds of thousands of rows while
 * the uncapped version would be tens of millions.
 *
 * Every statement is an INSERT ... SELECT: the aggregation stays inside
 * Postgres and no row travels through Node. That is the reason for the raw SQL
 * here, TypeORM's insert builder takes values, not a select, and it is the
 * same call shape `refreshToolStackStats` uses for its materialised view.
 *
 * Runs after `user-world-clickhouse`, whose districts and growth rows are the
 * input. Rerunnable: each table is replaced inside its own transaction, so a
 * failure part-way leaves the tables it had already reached consistent and the
 * retry simply rebuilds them again.
 */

/**
 * The catalogue this cron works over.
 *
 * Hidden niches are dropped here rather than at read time because the numbers
 * this builds are sums and counts, a district the world never draws must not
 * be inside a world's topic count, its article total or its top three, and
 * none of those can be corrected downstream.
 */
const visibleNiches = /* sql */ `"nicheId" NOT IN (SELECT id FROM niche WHERE slug = ANY($1))`;

const hidden = [...SERVING_HIDDEN_NICHE_SLUGS];

/**
 * The eligibility set, plus the four numbers a card shows.
 *
 * One pass over the districts table. The window functions give each district
 * its world's totals and its position within that world, so the top three fall
 * out of the same scan that counts them, a correlated "largest three" subquery
 * per world would re-read the same rows once more for every reader on the
 * platform.
 *
 * Private worlds are excluded here so nothing downstream has to know about them
 * at all. Read paths check again anyway, because this table is a day old.
 */
const rebuildSummary = async (manager: EntityManager): Promise<void> => {
  await manager.query(/* sql */ `DELETE FROM user_world_summary`);
  await manager.query(
    /* sql */ `
      INSERT INTO user_world_summary ("userId", "districts", "reads", "topNiches")
      SELECT
        "userId",
        min("districts")::int,
        min("total")::int,
        coalesce(
          jsonb_agg(
            jsonb_build_object('nicheId', "nicheId", 'reads', "reads")
            ORDER BY "position"
          ) FILTER (WHERE "position" <= $3),
          '[]'::jsonb
        )
      FROM (
        SELECT
          d."userId",
          d."nicheId",
          d."reads",
          row_number() OVER (
            PARTITION BY d."userId" ORDER BY d."reads" DESC, d."nicheId"
          ) AS "position",
          count(*) OVER (PARTITION BY d."userId") AS "districts",
          sum(d."reads") OVER (PARTITION BY d."userId") AS "total"
        FROM user_niche_analytics d
        WHERE d.${visibleNiches}
          AND NOT EXISTS (
            SELECT 1 FROM user_world_settings s
            WHERE s."userId" = d."userId" AND s.private = true
          )
      ) world
      WHERE "districts" >= $2
      GROUP BY "userId"
    `,
    [hidden, WORLD_INDEX_MIN_DISTRICTS, WORLD_INDEX_TOP_NICHES],
  );
};

/**
 * All-time ranking: the districts table, ordered inside each topic.
 *
 * `user_world_summary` is the eligibility join rather than a predicate, so the
 * floor and the privacy rule are applied in exactly one place. Ties break on
 * `userId`, arbitrary, but stable between runs, which keeps a reader from
 * swapping places with a neighbour on identical counts every night.
 */
const rebuildAllTimeRanks = (manager: EntityManager): Promise<void> =>
  manager.query(
    /* sql */ `
      INSERT INTO user_niche_rank ("nicheId", "period", "userId", "reads", "lifetimeReads")
      SELECT "nicheId", $4, "userId", "reads", "reads"
      FROM (
        SELECT
          d."nicheId",
          d."userId",
          d."reads",
          row_number() OVER (
            PARTITION BY d."nicheId" ORDER BY d."reads" DESC, d."userId"
          ) AS "position"
        FROM user_niche_analytics d
        INNER JOIN user_world_summary w ON w."userId" = d."userId"
        WHERE d.${visibleNiches}
      ) ranked
      WHERE "position" <= $2 AND "reads" > $3
    `,
    [hidden, WORLD_RANK_DEPTH, 0, UserNicheRankPeriod.All],
  );

/**
 * Weekly ranking: the growth log, summed over the window.
 *
 * The lifetime count is carried across from the districts table in the same
 * statement, because a weekly row still has to be shown at its level and a
 * week's reading is a rate that sits on no rung. The join is on the districts
 * table's own primary key, so it is a point lookup per group.
 *
 * `date` is bounded first, that is what the index on it exists for. Without it
 * this is a scan of every day the platform has ever recorded to answer a
 * question about seven of them.
 */
const rebuildWeekRanks = (
  manager: EntityManager,
  since: string,
): Promise<void> =>
  manager.query(
    /* sql */ `
      INSERT INTO user_niche_rank ("nicheId", "period", "userId", "reads", "lifetimeReads")
      SELECT "nicheId", $4, "userId", "reads", "lifetimeReads"
      FROM (
        SELECT
          g."nicheId",
          g."userId",
          sum(g."reads")::int AS "reads",
          max(d."reads") AS "lifetimeReads",
          row_number() OVER (
            PARTITION BY g."nicheId" ORDER BY sum(g."reads") DESC, g."userId"
          ) AS "position"
        FROM user_niche_growth g
        INNER JOIN user_world_summary w ON w."userId" = g."userId"
        INNER JOIN user_niche_analytics d
          ON d."userId" = g."userId" AND d."nicheId" = g."nicheId"
        WHERE g."date" >= $3 AND g.${visibleNiches}
        GROUP BY g."nicheId", g."userId"
      ) ranked
      WHERE "position" <= $2
    `,
    [hidden, WORLD_RANK_DEPTH, since, UserNicheRankPeriod.Week],
  );

/**
 * Readers per topic, over the whole population rather than the ranked top of
 * it, the two differ by however many readers a popular topic has past the
 * depth cap, which is most of them.
 */
const rebuildNicheStats = async (manager: EntityManager): Promise<void> => {
  await manager.query(/* sql */ `DELETE FROM niche_world_stats`);
  await manager.query(
    /* sql */ `
      INSERT INTO niche_world_stats ("nicheId", "readers")
      SELECT d."nicheId", count(*)::int
      FROM user_niche_analytics d
      INNER JOIN user_world_summary w ON w."userId" = d."userId"
      WHERE d.${visibleNiches}
      GROUP BY d."nicheId"
    `,
    [hidden],
  );
};

export const worldIndexCron: Cron = {
  name: 'world-index',
  handler: async (con) => {
    // Ordered, not parallel: the rankings and the topic counts both join the
    // summary, and joining last night's copy would rank worlds that no longer
    // qualify.
    await con.transaction(rebuildSummary);

    const since = subDays(new Date(), WORLD_RANK_WEEK_DAYS)
      .toISOString()
      .slice(0, 10);

    await con.transaction(async (manager) => {
      await manager.query(/* sql */ `DELETE FROM user_niche_rank`);
      await rebuildAllTimeRanks(manager);
      await rebuildWeekRanks(manager, since);
    });

    await con.transaction(rebuildNicheStats);

    await con.transaction((manager) =>
      manager.query(
        /* sql */ `DELETE FROM user_world_level_up WHERE "createdAt" < now() - ($1 || ' days')::interval`,
        [WORLD_LEVEL_UP_RETENTION_DAYS],
      ),
    );
  },
};
