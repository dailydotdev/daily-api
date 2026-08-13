import { Index, ViewColumn, ViewEntity } from 'typeorm';
import {
  WORLD_RANK_DEPTH,
  WORLD_RANK_WEEK_DAYS,
  hiddenNicheSqlList,
} from '../../common/worldIndex';

/** The two windows a topic is ranked over. */
export enum UserNicheRankPeriod {
  Week = 'week',
  All = 'all',
}

const visibleNiche = (alias: string): string =>
  `${alias}."nicheId" NOT IN (SELECT id FROM niche WHERE slug IN (${hiddenNicheSqlList}))`;

export const USER_NICHE_RANK_VIEW = /* sql */ `
  SELECT "nicheId", '${UserNicheRankPeriod.All}' AS "period", "userId", "reads", "reads" AS "lifetimeReads"
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
    WHERE ${visibleNiche('d')}
  ) ranked
  WHERE "position" <= ${WORLD_RANK_DEPTH} AND "reads" > 0

  UNION ALL

  SELECT "nicheId", '${UserNicheRankPeriod.Week}' AS "period", "userId", "reads", "lifetimeReads"
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
    WHERE g."date" >= (now() - interval '${WORLD_RANK_WEEK_DAYS} days')::date
      AND ${visibleNiche('g')}
    GROUP BY g."nicheId", g."userId"
  ) ranked
  WHERE "position" <= ${WORLD_RANK_DEPTH}
`;

/**
 * One topic's ranking, one row per (niche, period, reader).
 *
 * Neither period can be ranked live: all time would scan
 * `user_niche_analytics` by `nicheId`, the reverse of its key, and a week means
 * aggregating `user_niche_growth` across every reader of the topic. Both give
 * the same answer to every visitor.
 *
 * Only the top `WORLD_RANK_DEPTH` of each (niche, period) is kept, which is
 * also as deep as a placing means anything. Past the cap the API returns a null
 * rank, the same shape `leaderboardPosition` uses beyond its own cap.
 *
 * The week's window is evaluated at refresh time, so the view is self-contained.
 */
@ViewEntity({
  name: 'user_niche_rank',
  materialized: true,
  expression: USER_NICHE_RANK_VIEW,
})
@Index('UQ_user_niche_rank_key', ['nicheId', 'period', 'userId'], {
  unique: true,
})
/* Carries `userId` so it matches the listing's full ORDER BY (reads DESC,
   userId ASC) and the top of a topic comes off the index already sorted. On
   `reads` alone every tie left a sort behind, and ties are the common case at
   the shallow end of a ranking. */
@Index('IDX_user_niche_rank_listing', ['nicheId', 'period', 'reads', 'userId'])
export class UserNicheRank {
  @ViewColumn()
  nicheId: string;

  @ViewColumn()
  period: UserNicheRankPeriod;

  @ViewColumn()
  userId: string;

  /** Articles read in this niche inside the period. */
  @ViewColumn()
  reads: number;

  /**
   * Lifetime articles in this niche, carried so a weekly row can still be shown
   * at its level: a week's reading is a rate and a rate sits on no rung. The
   * count is stored rather than the level, which would freeze rows at whatever
   * thresholds were current at refresh.
   */
  @ViewColumn()
  lifetimeReads: number;
}
