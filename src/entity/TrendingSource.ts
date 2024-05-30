import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { TrendingPost } from './TrendingPost';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('"sourceId"')
      .addSelect('avg(r) r')
      .from(TrendingPost, 'base')
      .groupBy('"sourceId"')
      .having('count(*) > 1')
      .orderBy('r', 'DESC'),
})
export class TrendingSource {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  r: number;
}
