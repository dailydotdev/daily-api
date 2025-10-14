import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { TrendingUserPost } from './TrendingUserPost';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('"sourceId"')
      .addSelect('avg(r) r')
      .from(TrendingUserPost, 'base')
      .groupBy('"sourceId"')
      .having('count(*) > 1')
      .orderBy('r', 'DESC'),
})
export class TrendingUserSource {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  r: number;
}
