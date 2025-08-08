import { format } from 'date-fns';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import { postAnalyticsClickhouseSchema } from '../common/schema/postAnalytics';
import { z } from 'zod';
import { PostAnalytics } from '../entity/posts/PostAnalytics';

const lastRunTime = new Date('2025-01-01T00:00:00Z'); // TODO save to redis or database

export const postAnalyticsClickhouseCron: Cron = {
  name: 'post-analytics-clickhouse',
  handler: async (con, logger) => {
    const clickhouseClient = getClickHouseClient();

    const response = await clickhouseClient.query({
      query: `
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
            sum(shares_internal) AS "sharesInternal"
        FROM api.post_analytics
        FINAL
        WHERE created_at > {lastRunTime: DateTime}
        AND created_at < NOW()
        GROUP BY post_id
        ORDER BY "updatedAt" DESC;
      `,
      format: 'JSONEachRow',
      query_params: {
        lastRunTime: format(lastRunTime, 'yyyy-MM-dd HH:mm:ss'),
      },
    });

    const result = z
      .array(postAnalyticsClickhouseSchema)
      .safeParse(await response.json());

    if (!result.success) {
      logger.error(
        {
          schemaError: result.error.errors[0],
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

      chunks[chunks.length - 1].push({
        id: item.id,
        updatedAt: item.updatedAt,
        impressions: item.impressions,
        reach: item.reach,
        bookmarks: item.bookmarks,
        profileViews: item.profileViews,
        followers: item.followers,
        squadJoins: item.squadJoins,
        sharesExternal: item.sharesExternal,
        sharesInternal: item.sharesInternal,
      } as PostAnalytics);
    });

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
  },
};
