import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { Post } from './posts';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('"sourceId"')
      .addSelect('"tagsStr"')
      .addSelect('"createdAt"')
      .addSelect('upvotes - downvotes r')
      .from(Post, 'p')
      .where(
        'not p.private and p."createdAt" > now() - interval \'60 day\' and upvotes > downvotes',
      )
      .orderBy('r', 'DESC')
      .limit(1000),
})
export class PopularPost {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  tagsStr: string;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  r: number;
}
