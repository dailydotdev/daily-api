import { Index, ViewColumn, ViewEntity } from 'typeorm';
import { hiddenNicheSqlList } from '../common/worldIndex';

export const DOMAIN_WORLD_STATS_VIEW = /* sql */ `
  SELECT n.domain AS "domain", count(DISTINCT d."userId")::int AS "readers"
  FROM user_niche_analytics d
  INNER JOIN user_world_summary w ON w."userId" = d."userId"
  INNER JOIN niche n ON n.id = d."nicheId"
  WHERE n.domain IS NOT NULL AND n.slug NOT IN (${hiddenNicheSqlList})
  GROUP BY n.domain
`;

/**
 * Listable worlds that have read anything in each domain.
 *
 * `count(DISTINCT "userId")`, not a sum of the niche counts. Somebody who reads
 * both Rust and C/C++ appears in two niche counts and is still one reader of
 * the systems domain, and reading several niches inside one domain is the
 * common case rather than the exception, so summing would overstate every
 * domain and overstate the broadest ones most.
 */
@ViewEntity({
  name: 'domain_world_stats',
  materialized: true,
  expression: DOMAIN_WORLD_STATS_VIEW,
})
@Index('UQ_domain_world_stats_domain', ['domain'], { unique: true })
export class DomainWorldStats {
  @ViewColumn()
  domain: string;

  @ViewColumn()
  readers: number;
}
