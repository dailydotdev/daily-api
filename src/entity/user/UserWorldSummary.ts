import { Index, ViewColumn, ViewEntity } from 'typeorm';
import {
  WORLD_INDEX_MIN_DISTRICTS,
  WORLD_INDEX_TOP_NICHES,
  hiddenNicheSqlList,
} from '../../common/worldIndex';

/** One entry of a summary's top districts. */
export type UserWorldSummaryTopNiche = {
  nicheId: string;
  reads: number;
};

export const USER_WORLD_SUMMARY_VIEW = /* sql */ `
  SELECT
    "userId",
    min("districts")::int AS "districts",
    min("total")::int AS "reads",
    coalesce(
      jsonb_agg(
        jsonb_build_object('nicheId', "nicheId", 'reads', "reads")
        ORDER BY "position"
      ) FILTER (WHERE "position" <= ${WORLD_INDEX_TOP_NICHES}),
      '[]'::jsonb
    ) AS "topNiches"
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
    WHERE d."nicheId" NOT IN (SELECT id FROM niche WHERE slug IN (${hiddenNicheSqlList}))
      AND NOT EXISTS (
        SELECT 1 FROM user_world_settings s
        WHERE s."userId" = d."userId" AND s.private = true
      )
  ) world
  WHERE "districts" >= ${WORLD_INDEX_MIN_DISTRICTS}
  GROUP BY "userId"
`;

/**
 * The worlds worth listing, and the numbers a card shows.
 *
 * Doubles as the eligibility set: a row exists only for a public world that has
 * cleared `WORLD_INDEX_MIN_DISTRICTS`, so every listing joins this rather than
 * re-deriving who may be shown.
 *
 * Privacy is not delegated to it. Refreshes are nightly, so a world made
 * private today still has a row until the next one, and every read path
 * anti-joins `user_world_settings` live on top (`applyWorldIndexPrivacy`).
 * Filtering in both places means a bug in either alone cannot leak a world.
 */
@ViewEntity({
  name: 'user_world_summary',
  materialized: true,
  expression: USER_WORLD_SUMMARY_VIEW,
})
@Index('UQ_user_world_summary_userId', ['userId'], { unique: true })
@Index('IDX_user_world_summary_reads', ['reads'])
export class UserWorldSummary {
  @ViewColumn()
  userId: string;

  /** Districts held, after serving-hidden niches are dropped. */
  @ViewColumn()
  districts: number;

  /** Articles read across every district. */
  @ViewColumn()
  reads: number;

  /**
   * Largest districts first, capped at `WORLD_INDEX_TOP_NICHES`. Ids rather
   * than titles, which can be edited.
   */
  @ViewColumn()
  topNiches: UserWorldSummaryTopNiche[];
}
