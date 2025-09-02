import { format, startOfToday } from 'date-fns';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import { postAnalyticsBoostClickhouseSchema } from '../common/schema/postAnalytics';
import { z } from 'zod';
import { PostAnalytics } from '../entity/posts/PostAnalytics';
import { getRedisHash, setRedisHash } from '../redis';
import { generateStorageKey, StorageTopic } from '../config';

type PostAnalyticsBoostClickhouseCronConfig = Partial<{
  lastRunAt: string;
}>;

type PostAnalyticsBoost = Pick<
  PostAnalytics,
  'id' | 'updatedAt' | 'boostImpressions' | 'boostReach'
>;

export const postAnalyticsBoostClickhouseCron: Cron = {
  name: 'post-analytics-boost-clickhouse',
  handler: async (con, logger) => {
    const redisStorageKey = generateStorageKey(
      StorageTopic.Cron,
      postAnalyticsBoostClickhouseCron.name,
      'config',
    );

    const cronConfig: Partial<PostAnalyticsBoostClickhouseCronConfig> =
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
          "postId" as id,
          sum(impressions) AS "boostImpressions",
          uniqIfMerge(unique_users) AS "boostReach",
          max(ad_impressions_totals.updated_at) AS "updatedAt"
        FROM
          skadi.ad_impressions_totals FINAL
        LEFT JOIN skadi.ad_clicks_totals FINAL ON
          ad_impressions_totals.campaign_id = ad_clicks_totals.campaign_id
        LEFT JOIN api.campaign FINAL ON
          ad_impressions_totals.campaign_id = toString(campaign.id)
        WHERE
          "postId" != ''
          AND "postId" IS NOT NULL
        GROUP BY
          "postId"
        HAVING "updatedAt" > {lastRunAt: DateTime}
        ORDER BY "updatedAt" DESC;
      `,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    const result = z
      .array(postAnalyticsBoostClickhouseSchema)
      .safeParse(await response.json());

    if (!result.success) {
      logger.error(
        {
          schemaError: result.error.issues[0],
        },
        'Invalid data',
      );

      throw new Error('Invalid data');
    }

    const { data } = result;

    const chunks: PostAnalyticsBoost[][] = [];
    const chunkSize = 500;

    data.forEach((item) => {
      if (
        chunks.length === 0 ||
        chunks[chunks.length - 1].length === chunkSize
      ) {
        chunks.push([]);
      }

      chunks[chunks.length - 1].push(item as PostAnalyticsBoost);
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

    await setRedisHash<PostAnalyticsBoostClickhouseCronConfig>(
      redisStorageKey,
      {
        lastRunAt: currentRunAt.toISOString(),
      },
    );

    logger.info({ rows: data.length, queryParams }, 'synced data');
  },
};
