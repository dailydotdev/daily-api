import { format, startOfToday } from 'date-fns';
import { z } from 'zod';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import { userProfileAnalyticsHistoryClickhouseSchema } from '../common/schema/userProfileAnalytics';
import { UserProfileAnalyticsHistory } from '../entity/user/UserProfileAnalyticsHistory';
import { getRedisHash, setRedisHash } from '../redis';
import { generateStorageKey, StorageTopic } from '../config';

type UserProfileAnalyticsHistoryClickhouseCronConfig = Partial<{
  lastRunAt: string;
}>;

export const userProfileAnalyticsHistoryClickhouseCron: Cron = {
  name: 'user-profile-analytics-history-clickhouse',
  handler: async (con, logger) => {
    const redisStorageKey = generateStorageKey(
      StorageTopic.Cron,
      userProfileAnalyticsHistoryClickhouseCron.name,
      'config',
    );

    const cronConfig: Partial<UserProfileAnalyticsHistoryClickhouseCronConfig> =
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
      date: format(new Date(), 'yyyy-MM-dd'),
    };

    const response = await clickhouseClient.query({
      query: /* sql */ `
        SELECT
          user_id AS id,
          date,
          max(created_at) AS "updatedAt",
          uniqMerge(unique_visitors) AS "uniqueVisitors"
        FROM api.user_profile_analytics_history
        FINAL
        WHERE date = {date: Date}
        GROUP BY date, id
        HAVING "updatedAt" > {lastRunAt: DateTime}
      `,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    const result = z
      .array(userProfileAnalyticsHistoryClickhouseSchema)
      .safeParse(await response.json());

    if (!result.success) {
      logger.error(
        { schemaError: result.error.issues[0] },
        'Invalid user profile analytics history data',
      );
      throw new Error('Invalid user profile analytics history data');
    }

    const { data } = result;

    const chunks: UserProfileAnalyticsHistory[][] = [];
    const chunkSize = 500;

    data.forEach((item) => {
      if (
        chunks.length === 0 ||
        chunks[chunks.length - 1].length === chunkSize
      ) {
        chunks.push([]);
      }
      chunks[chunks.length - 1].push(item as UserProfileAnalyticsHistory);
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
          .into(UserProfileAnalyticsHistory)
          .values(chunk)
          .orUpdate(Object.keys(chunk[0]), ['id', 'date'])
          .execute();
      }
    });

    await setRedisHash<UserProfileAnalyticsHistoryClickhouseCronConfig>(
      redisStorageKey,
      {
        lastRunAt: currentRunAt.toISOString(),
      },
    );

    logger.info(
      { rows: data.length, queryParams },
      'synced user profile analytics history data',
    );
  },
};
