import { Index, ViewColumn, ViewEntity } from 'typeorm';
import { hiddenNicheSqlList } from '../common/worldIndex';

export const NICHE_WORLD_STATS_VIEW = /* sql */ `
  SELECT d."nicheId", count(*)::int AS "readers"
  FROM user_niche_analytics d
  INNER JOIN user_world_summary w ON w."userId" = d."userId"
  WHERE d."nicheId" NOT IN (SELECT id FROM niche WHERE slug IN (${hiddenNicheSqlList}))
  GROUP BY d."nicheId"
`;

/**
 * Listable worlds holding a district in each niche.
 *
 * Separate from `user_niche_rank` because that keeps only the top of the
 * population: readers past the depth cap still count, they just cannot be
 * ranked.
 */
@ViewEntity({
  name: 'niche_world_stats',
  materialized: true,
  expression: NICHE_WORLD_STATS_VIEW,
})
@Index('UQ_niche_world_stats_nicheId', ['nicheId'], { unique: true })
export class NicheWorldStats {
  @ViewColumn()
  nicheId: string;

  @ViewColumn()
  readers: number;
}
