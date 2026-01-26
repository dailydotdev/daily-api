import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { HotTake } from './user';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('id', 'hotTakeId')
      .addSelect('upvotes', 'score')
      .from(HotTake, 'base')
      .where('upvotes > 0')
      .orderBy('upvotes', 'DESC')
      .addOrderBy(`"createdAt"`, 'DESC'),
})
export class PopularHotTake {
  @ViewColumn()
  hotTakeId: string;

  @ViewColumn()
  score: number;
}
