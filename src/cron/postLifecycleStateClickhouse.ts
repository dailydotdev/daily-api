import { format, startOfToday } from 'date-fns';
import { In } from 'typeorm';
import { z } from 'zod';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import {
  postLifecycleStateClickhouseSchema,
  isTrackedLifecycleState,
} from '../common/schema/postLifecycleState';
import {
  PostLifecycleState,
  PostLifecycleStateValue,
} from '../entity/PostLifecycleState';
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

    const { data } = result;
    const upserts: Array<{
      postId: string;
      state: PostLifecycleStateValue;
    }> = [];
    const deleteIds: string[] = [];

    data.forEach((item) => {
      if (isTrackedLifecycleState(item.state)) {
        upserts.push({ postId: item.post_id, state: item.state });
      } else {
        deleteIds.push(item.post_id);
      }
    });

    const currentRunAt = new Date();

    await con.transaction(async (entityManager) => {
      const repo = entityManager.getRepository(PostLifecycleState);

      if (upserts.length) {
        await repo
          .createQueryBuilder()
          .insert()
          .values(
            upserts.map(({ postId, state }) => ({
              postId,
              state,
              updatedAt: currentRunAt,
            })),
          )
          .orUpdate(['state', 'updatedAt'], ['postId'])
          .execute();
      }

      if (deleteIds.length) {
        await repo.delete({ postId: In(deleteIds) });
      }
    });

    await con.query('REFRESH MATERIALIZED VIEW CONCURRENTLY post_hero');

    await setRedisHash<PostLifecycleStateClickhouseCronConfig>(
      redisStorageKey,
      {
        lastRunAt: currentRunAt.toISOString(),
      },
    );
  },
};
