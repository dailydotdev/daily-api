import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { TrendingPost } from './TrendingPost';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('unnest(string_to_array("tagsStr", \',\')) tag')
      .addSelect('avg(r) r')
      .from(TrendingPost, 'tp')
      .groupBy('tag')
      .having('count(*) > 1')
      .orderBy('r', 'DESC'),
})
export class TrendingTag {
  @ViewColumn()
  tag: string;

  @ViewColumn()
  r: number;
}
