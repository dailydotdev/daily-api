import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { PopularPost } from './PopularPost';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('"sourceId"')
      .addSelect('avg(r) r')
      .from(PopularPost, 'base')
      .groupBy('"sourceId"')
      .having('count(*) > 5')
      .orderBy('r', 'DESC'),
})
export class PopularSource {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  r: number;
}
