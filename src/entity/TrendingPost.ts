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
      .addSelect(
        `log(10, upvotes - downvotes) + extract(epoch from ("createdAt" - now() + interval '7 days')) / 200000 r`,
      )
      .from(Post, 'p')
      .where(
        `not p.private and p."createdAt" > now() - interval '7 day' and upvotes > downvotes`,
      )
      .orderBy('r', 'DESC')
      .limit(100),
})
export class TrendingPost {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  tagsStr: string;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  r: number;
}
