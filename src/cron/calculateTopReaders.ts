import { PostKeyword, View } from '../entity';
import type { Cron } from './cron';

export const calculateTopReaders: Cron = {
  name: 'calculate-top-readers',
  handler: async (con) => {
    const currentDate = `date_trunc('month', CURRENT_DATE)`;

    const viewsSubquery = con
      .createQueryBuilder()
      .select(['"v"."postId"', '"v"."userId"', '"pk"."keyword"'])
      .from(View, 'v')
      .innerJoin(PostKeyword, 'pk', '"v"."postId" = "pk"."postId"')
      .where(`"pk"."status" = 'allow'`)
      .andWhere(`"v"."timestamp" >= (${currentDate} - INTERVAL '1 month')`)
      .andWhere(`"v"."timestamp" <  (${currentDate})`);

    const distinctViewsSubquery = con
      .createQueryBuilder()
      .from('views', 'v')
      .select(['"v"."userId"', '"v"."keyword"'])
      .groupBy('"v"."userId"')
      .addGroupBy('"v"."keyword"');

    const topKeywordsSubquery = con
      .createQueryBuilder()
      .from('distinct_views', 'dv')
      .select(['COUNT("dv"."keyword") AS "count"', '"dv"."keyword"'])
      .groupBy('"dv"."keyword"')
      // .having(`COUNT("dv"."keyword") >= 500`)
      .orderBy('"dv"."count"', 'DESC');

    const keywordUserCountsSubquery = con
      .createQueryBuilder()
      .select([`COUNT(*) AS "userViewCount"`, `"v"."keyword"`, `"v"."userId"`])
      .from('views', 'v')
      .innerJoin('top_keywords', 'tk', '"v"."keyword" = "tk"."keyword"')
      .groupBy(`"v"."keyword"`)
      .addGroupBy(`"v"."userId"`);

    const rankedUsersSubquery = con
      .createQueryBuilder()
      .select([
        `ROW_NUMBER() OVER (PARTITION BY "kuc"."keyword" ORDER BY "kuc"."userViewCount" DESC) AS "rank"`,
        `"kuc"."keyword"`,
        `"kuc"."userId"`,
        `"kuc"."userViewCount"`,
      ])
      .from('keyword_user_counts', 'kuc');

    const finalSelect = con
      .createQueryBuilder()
      .select([
        `"ru"."keyword"`,
        `"tk"."count" AS "keyword_rank"`,
        `"ru"."userId"`,
        `"ru"."userViewCount"`,
        `"ru"."rank"`,
      ])
      .from('ranked_users', 'ru')
      .innerJoin('top_keywords', 'tk', '"tk"."keyword" = "ru"."keyword"')
      .where(`"ru"."rank" <= 100`)
      .orderBy(`"tk"."count"`, 'DESC')
      .addOrderBy(`"ru"."rank"`, 'ASC');

    const finalQuery = await con.query(`WITH
        views AS MATERIALIZED (${viewsSubquery.getSql()}),
        distinct_views AS MATERIALIZED (${distinctViewsSubquery.getSql()}),
        top_keywords AS (${topKeywordsSubquery.getSql()}),
        keyword_user_counts AS (${keywordUserCountsSubquery.getSql()}),
        ranked_users AS (${rankedUsersSubquery.getSql()})
      ${finalSelect.getSql()}`);

    console.log(finalQuery);
  },
};
