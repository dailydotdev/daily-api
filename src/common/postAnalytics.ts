import { format, subDays } from 'date-fns';
import type { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { PostAnalyticsHistory } from '../entity/posts/PostAnalyticsHistory';
import { queryReadReplica } from './queryReadReplica';
import { transformDate } from './date';

type AnalyticsHistoryRow = {
  date: string;
  impressions: number;
  impressionsAds: number;
};

type PostAnalyticsHistoryQueryBuilder = SelectQueryBuilder<PostAnalyticsHistory>;

type WhereClauseBuilder = (
  qb: PostAnalyticsHistoryQueryBuilder,
) => PostAnalyticsHistoryQueryBuilder;

export const getPostAnalyticsHistory = async ({
  con,
  whereClause,
  days = 45,
}: {
  con: DataSource | EntityManager;
  whereClause: WhereClauseBuilder;
  days?: number;
}): Promise<AnalyticsHistoryRow[]> => {
  const cutoffDate = subDays(new Date(), days);
  const formattedDate = format(cutoffDate, 'yyyy-MM-dd');

  const result = await queryReadReplica(con, ({ queryRunner }) => {
    const qb = queryRunner.manager
      .getRepository(PostAnalyticsHistory)
      .createQueryBuilder('pah')
      .innerJoin('pah.post', 'p')
      .select('pah.date', 'date')
      .addSelect(
        'SUM(pah.impressions + pah.impressionsAds)::int',
        'impressions',
      )
      .addSelect('SUM(pah.impressionsAds)::int', 'impressionsAds')
      .andWhere('p.deleted = false')
      .andWhere('pah.date >= :formattedDate', { formattedDate })
      .groupBy('pah.date')
      .orderBy('pah.date', 'DESC');

    return whereClause(qb).getRawMany();
  });

  return result.map((row) => ({ ...row, date: transformDate(row.date) }));
};
