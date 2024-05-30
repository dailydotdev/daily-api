import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { PopularPost } from './PopularPost';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('unnest(string_to_array("tagsStr", \',\')) tag')
      .addSelect('avg(r) r')
      .from(PopularPost, 'base')
      .groupBy('tag')
      .having('count(*) > 10')
      .orderBy('r', 'DESC'),
})
export class PopularTag {
  @ViewColumn()
  tag: string;

  @ViewColumn()
  r: number;
}
