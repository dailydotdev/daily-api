import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { PopularUserPost } from './PopularUserPost';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('"sourceId"')
      .addSelect('avg(r) r')
      .from(PopularUserPost, 'base')
      .groupBy('"sourceId"')
      .having('count(*) > 5')
      .orderBy('r', 'DESC'),
})
export class PopularUserSource {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  r: number;
}
