import { Index, ViewColumn, ViewEntity } from 'typeorm';
import {
  WORLD_RANK_DEPTH,
  WORLD_RANK_WEEK_DAYS,
  hiddenNicheSqlList,
} from '../../common/worldIndex';
import { UserNicheRankPeriod } from './UserNicheRank';

/** Niches that carry a domain and are not hidden at serving time. */
const domainNiche = /* sql */ `
  SELECT id, domain FROM niche
  WHERE domain IS NOT NULL AND slug NOT IN (${hiddenNicheSqlList})
`;

export const USER_DOMAIN_RANK_VIEW = /* sql */ `
  SELECT "domain", '${UserNicheRankPeriod.All}' AS "period", "userId", "reads"
  FROM (
    SELECT
      n.domain AS "domain",
      d."userId",
      sum(d."reads")::int AS "reads",
      row_number() OVER (
        PARTITION BY n.domain ORDER BY sum(d."reads") DESC, d."userId"
      ) AS "position"
    FROM user_niche_analytics d
    INNER JOIN user_world_summary w ON w."userId" = d."userId"
    INNER JOIN (${domainNiche}) n ON n.id = d."nicheId"
    GROUP BY n.domain, d."userId"
  ) ranked
  WHERE "position" <= ${WORLD_RANK_DEPTH} AND "reads" > 0

  UNION ALL

  SELECT "domain", '${UserNicheRankPeriod.Week}' AS "period", "userId", "reads"
  FROM (
    SELECT
      n.domain AS "domain",
      g."userId",
      sum(g."reads")::int AS "reads",
      row_number() OVER (
        PARTITION BY n.domain ORDER BY sum(g."reads") DESC, g."userId"
      ) AS "position"
    FROM user_niche_growth g
    INNER JOIN user_world_summary w ON w."userId" = g."userId"
    INNER JOIN (${domainNiche}) n ON n.id = g."nicheId"
    WHERE g."date" >= (now() - interval '${WORLD_RANK_WEEK_DAYS} days')::date
    GROUP BY n.domain, g."userId"
  ) ranked
  WHERE "position" <= ${WORLD_RANK_DEPTH}
`;

/**
 * A domain's ranking, one row per (domain, period, reader).
 *
 * The reason this cannot be assembled from `user_niche_rank` is the depth cap.
 * That view keeps only the top `WORLD_RANK_DEPTH` of each niche, so a reader
 * spread evenly across six niches in a domain can sit past the cap in every one
 * of them and still out-read somebody who is top ten in a single niche. Summing
 * the capped rows would therefore not be an approximation, it would be a
 * ranking that systematically favours specialists, which is the opposite of
 * what a domain board is for. The aggregation has to happen before the cap, so
 * it happens here, against the districts themselves.
 *
 * No `lifetimeReads`: a level is a property of one district on the twelve-rung
 * ladder, and a sum across a domain sits on no rung at all.
 */
@ViewEntity({
  name: 'user_domain_rank',
  materialized: true,
  expression: USER_DOMAIN_RANK_VIEW,
})
@Index('UQ_user_domain_rank_key', ['domain', 'period', 'userId'], {
  unique: true,
})
@Index('IDX_user_domain_rank_listing', ['domain', 'period', 'reads', 'userId'])
export class UserDomainRank {
  @ViewColumn()
  domain: string;

  @ViewColumn()
  period: UserNicheRankPeriod;

  @ViewColumn()
  userId: string;

  /** Articles read across the whole domain inside the period. */
  @ViewColumn()
  reads: number;
}
