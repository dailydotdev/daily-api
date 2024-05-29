import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { PopularVideoPost } from './PopularVideoPost';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('"sourceId"')
      .addSelect('avg(r) r')
      .addSelect('count(*) posts')
      .from(PopularVideoPost, 'base')
      .groupBy('"sourceId"')
      .having('count(*) > 5')
      .orderBy('r', 'DESC'),
})
export class PopularVideoSource {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  r: number;

  @ViewColumn()
  posts: number;
}
