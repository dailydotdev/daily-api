import { format, startOfToday } from 'date-fns';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import { postAnalyticsHistoryClickhouseSchema } from '../common/schema/postAnalytics';
import { z } from 'zod';
import { getRedisHash, setRedisHash } from '../redis';
import { generateStorageKey, StorageTopic } from '../config';
import { PostAnalyticsHistory } from '../entity/posts/PostAnalyticsHistory';

type PostAnalyticsHistoryClickhouseCronConfig = Partial<{
  lastRunAt: string;
}>;

export const postAnalyticsHistoryDayClickhouseCron: Cron = {
  name: 'post-analytics-history-day-clickhouse',
  handler: async (con, logger) => {
    const redisStorageKey = generateStorageKey(
      StorageTopic.Cron,
      postAnalyticsHistoryDayClickhouseCron.name,
      'config',
    );

    const cronConfig: Partial<PostAnalyticsHistoryClickhouseCronConfig> =
      await getRedisHash(redisStorageKey);

    const lastRunAt = cronConfig.lastRunAt
      ? new Date(cronConfig.lastRunAt)
      : startOfToday(); // for now use start of today if no last run time is set

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
          post_id AS id,
          date,
          max(created_at) AS "updatedAt",
          sum(impressions) AS impressions
        FROM api.post_analytics_history
        FINAL
        WHERE date = {date: Date}
        GROUP BY date, id
        HAVING "updatedAt" > {lastRunAt: DateTime}
      `,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    const result = z
      .array(postAnalyticsHistoryClickhouseSchema)
      .safeParse(await response.json());

    if (!result.success) {
      logger.error(
        {
          schemaError: result.error.issues[0],
        },
        'Invalid post analytics data',
      );

      throw new Error('Invalid post analytics data');
    }

    const { data } = result;

    const chunks: PostAnalyticsHistory[][] = [];
    const chunkSize = 500;

    data.forEach((item) => {
      if (
        chunks.length === 0 ||
        chunks[chunks.length - 1].length === chunkSize
      ) {
        chunks.push([]);
      }

      chunks[chunks.length - 1].push(item as PostAnalyticsHistory);
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
          .into(PostAnalyticsHistory)
          .values(chunk)
          .orUpdate(Object.keys(chunk[0]), ['id', 'date'])
          .execute();
      }
    });

    await setRedisHash<PostAnalyticsHistoryClickhouseCronConfig>(
      redisStorageKey,
      {
        lastRunAt: currentRunAt.toISOString(),
      },
    );

    logger.info(
      { rows: data.length, queryParams },
      'synced post analytics history data',
    );
  },
};
