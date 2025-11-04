import { format, startOfToday } from 'date-fns';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import { postAnalyticsClickhouseSchema } from '../common/schema/postAnalytics';
import { z } from 'zod';
import { PostAnalytics } from '../entity/posts/PostAnalytics';
import { getRedisHash, setRedisHash } from '../redis';
import { generateStorageKey, StorageTopic } from '../config';

type PostAnalyticsClickhouseCronConfig = Partial<{
  lastRunAt: string;
}>;

export const postAnalyticsClickhouseCron: Cron = {
  name: 'post-analytics-clickhouse',
  handler: async (con, logger) => {
    const redisStorageKey = generateStorageKey(
      StorageTopic.Cron,
      postAnalyticsClickhouseCron.name,
      'config',
    );

    const cronConfig: Partial<PostAnalyticsClickhouseCronConfig> =
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
    };

    const response = await clickhouseClient.query({
      query: /* sql */ `
        SELECT
            post_id AS id,
            max(created_at) AS "updatedAt",
            sum(impressions) AS impressions,
            uniqMerge(reach) AS reach,
            uniqMerge(bookmarks) AS bookmarks,
            uniqMerge(profile_views) AS "profileViews",
            uniqMerge(followers) AS followers,
            uniqMerge(squad_joins) AS "squadJoins",
            sum(shares_external) AS "sharesExternal",
            sum(shares_internal) AS "sharesInternal",
            sum(impressions_ads) AS "impressionsAds",
            uniqMerge(reach_ads) AS "reachAds",
            uniqMerge(reach_all) AS "reachAll",
            sum(clicks) AS clicks,
            sum(clicks_ads) AS "clicksAds",
            sum(go_to_link) AS "goToLink"
        FROM api.post_analytics
        WHERE "created_at" > {lastRunAt: DateTime}
        GROUP BY id
        HAVING "updatedAt" > {lastRunAt: DateTime}
        ORDER BY "updatedAt" DESC;
      `,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    const result = z
      .array(postAnalyticsClickhouseSchema)
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

    const chunks: PostAnalytics[][] = [];
    const chunkSize = 500;

    data.forEach((item) => {
      if (
        chunks.length === 0 ||
        chunks[chunks.length - 1].length === chunkSize
      ) {
        chunks.push([]);
      }

      chunks[chunks.length - 1].push(item as PostAnalytics);
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
          .into(PostAnalytics)
          .values(chunk)
          .orUpdate(Object.keys(chunk[0]), ['id'])
          .execute();
      }
    });

    await setRedisHash<PostAnalyticsClickhouseCronConfig>(redisStorageKey, {
      lastRunAt: currentRunAt.toISOString(),
    });

    logger.info(
      { rows: data.length, queryParams },
      'synced post analytics data',
    );
  },
};
