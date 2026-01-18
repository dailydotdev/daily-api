import { format, startOfToday } from 'date-fns';
import { z } from 'zod';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import { userProfileAnalyticsClickhouseSchema } from '../common/schema/userProfileAnalytics';
import { UserProfileAnalytics } from '../entity/user/UserProfileAnalytics';
import { getRedisHash, setRedisHash } from '../redis';
import { generateStorageKey, StorageTopic } from '../config';

type UserProfileAnalyticsClickhouseCronConfig = Partial<{
  lastRunAt: string;
}>;

export const userProfileAnalyticsClickhouseCron: Cron = {
  name: 'user-profile-analytics-clickhouse',
  handler: async (con, logger) => {
    const redisStorageKey = generateStorageKey(
      StorageTopic.Cron,
      userProfileAnalyticsClickhouseCron.name,
      'config',
    );

    const cronConfig: Partial<UserProfileAnalyticsClickhouseCronConfig> =
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
            user_id AS id,
            max(created_at) AS "updatedAt",
            uniqMerge(unique_visitors) AS "uniqueVisitors"
        FROM api.user_profile_analytics
        FINAL
        WHERE user_id IN (
          SELECT DISTINCT user_id
          FROM api.user_profile_analytics
          WHERE created_at > {lastRunAt: DateTime}
        )
        GROUP BY id
        HAVING "updatedAt" > {lastRunAt: DateTime}
        ORDER BY "updatedAt" DESC;
      `,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    const result = z
      .array(userProfileAnalyticsClickhouseSchema)
      .safeParse(await response.json());

    if (!result.success) {
      logger.error(
        { schemaError: result.error.issues[0] },
        'Invalid user profile analytics data',
      );
      throw new Error('Invalid user profile analytics data');
    }

    const { data } = result;

    const chunks: UserProfileAnalytics[][] = [];
    const chunkSize = 500;

    data.forEach((item) => {
      if (
        chunks.length === 0 ||
        chunks[chunks.length - 1].length === chunkSize
      ) {
        chunks.push([]);
      }
      chunks[chunks.length - 1].push(item as UserProfileAnalytics);
    });

    const currentRunAt = new Date();

    await con.transaction(async (entityManager) => {
      for (const chunk of chunks) {
        if (chunk.length === 0) {
          continue;
        }

        await entityManager
          .createQueryBuilder()
          .insert()
          .into(UserProfileAnalytics)
          .values(chunk)
          .orUpdate(Object.keys(chunk[0]), ['id'])
          .execute();
      }
    });

    await setRedisHash<UserProfileAnalyticsClickhouseCronConfig>(
      redisStorageKey,
      {
        lastRunAt: currentRunAt.toISOString(),
      },
    );

    logger.info(
      { rows: data.length, queryParams },
      'synced user profile analytics data',
    );
  },
};
