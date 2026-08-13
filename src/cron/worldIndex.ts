import type { Cron } from './cron';
import { WORLD_LEVEL_UP_RETENTION_DAYS } from '../common/worldIndex';
import { DomainWorldStats } from '../entity/DomainWorldStats';
import { NicheWorldStats } from '../entity/NicheWorldStats';
import { UserDomainRank } from '../entity/user/UserDomainRank';
import { UserNicheRank } from '../entity/user/UserNicheRank';
import { UserWorldSummary } from '../entity/user/UserWorldSummary';

/**
 * Refreshes what the world index reads from, and sweeps expired crossings.
 *
 * Ordered, not parallel: the rankings and the topic counts both join the
 * summary, and refreshing them against last night's copy would rank worlds that
 * no longer qualify. CONCURRENTLY so the index keeps serving during the
 * refresh, which every view here has the unique index for.
 *
 * Runs after `user-world-clickhouse`, whose districts and growth rows are the
 * input.
 */
const refreshOrder = [
  UserWorldSummary,
  UserNicheRank,
  NicheWorldStats,
  UserDomainRank,
  DomainWorldStats,
];

export const worldIndexCron: Cron = {
  name: 'world-index',
  handler: async (con) => {
    for (const view of refreshOrder) {
      await con.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY ${con.getRepository(view).metadata.tableName}`,
      );
    }

    await con.query(
      /* sql */ `DELETE FROM user_world_level_up WHERE "createdAt" < now() - ($1 || ' days')::interval`,
      [WORLD_LEVEL_UP_RETENTION_DAYS],
    );
  },
};
