import { format, startOfToday } from 'date-fns';
import { z } from 'zod';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import { postLifecycleStateClickhouseSchema } from '../common/schema/postLifecycleState';
import { PostLifecycleState } from '../entity/PostLifecycleState';
import type { PostLifecycleStateValue } from '../common/postLifecycleState';
import { getRedisHash, setRedisHash } from '../redis';
import { generateStorageKey, StorageTopic } from '../config';

type PostLifecycleStateClickhouseCronConfig = Partial<{
  lastRunAt: string;
}>;

export const postLifecycleStateClickhouseCron: Cron = {
  name: 'post-lifecycle-state-clickhouse',
  handler: async (con, logger) => {
    const redisStorageKey = generateStorageKey(
      StorageTopic.Cron,
      postLifecycleStateClickhouseCron.name,
      'config',
    );

    const cronConfig: Partial<PostLifecycleStateClickhouseCronConfig> =
      await getRedisHash(redisStorageKey);

    const lastRunAt = cronConfig.lastRunAt
      ? new Date(cronConfig.lastRunAt)
      : startOfToday();

    if (Number.isNaN(lastRunAt.getTime())) {
      throw new Error('Invalid last run time');
    }

    const clickhouseClient = getClickHouseClient();

    const queryParams = {
      lastRunAt: format(lastRunAt, 'yyyy-MM-dd HH:mm:ss'),
    };

    const response = await clickhouseClient.query({
      query: /* sql */ `
        SELECT
            post_id,
            argMax(state, updated_at) AS state,
            max(updated_at) AS last_updated_at
        FROM feed.post_lifecycle_state
        FINAL
        WHERE updated_at >= {lastRunAt: DateTime}
        GROUP BY post_id
        ORDER BY last_updated_at;
      `,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    const result = z
      .array(postLifecycleStateClickhouseSchema)
      .safeParse(await response.json());

    if (!result.success) {
      logger.error(
        {
          schemaError: result.error.issues[0],
        },
        'Invalid post lifecycle state data',
      );

      throw new Error('Invalid post lifecycle state data');
    }

    const upserts = result.data.map((item) => ({
      postId: item.post_id,
      state: item.state as PostLifecycleStateValue,
      updatedAt: item.last_updated_at,
    }));

    const currentRunAt = new Date();

    if (upserts.length) {
      await con
        .getRepository(PostLifecycleState)
        .createQueryBuilder()
        .insert()
        .values(upserts)
        .orUpdate(['state', 'updatedAt'], ['postId'])
        .execute();
    }

    await con.query('REFRESH MATERIALIZED VIEW CONCURRENTLY post_hero');

    await setRedisHash<PostLifecycleStateClickhouseCronConfig>(
      redisStorageKey,
      {
        lastRunAt: currentRunAt.toISOString(),
      },
    );

    logger.info(
      { rows: upserts.length, queryParams },
      'synced post lifecycle state data',
    );
  },
};
