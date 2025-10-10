import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { SourceType } from './Source';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('p."sourceId"')
      .addSelect('p."tagsStr"')
      .addSelect('p."createdAt"')
      .addSelect(
        `log(10, p.upvotes - p.downvotes) + extract(epoch from (p."createdAt" - now() + interval '7 days')) / 200000`,
        'r',
      )
      .from('post', 'p')
      .innerJoin('source', 's', 's.id = p."sourceId"')
      .where(
        `not p.private and p."createdAt" > now() - interval '7 day' and p.upvotes > p.downvotes`,
      )
      .andWhere('s.type = :type', { type: SourceType.User })
      .orderBy('r', 'DESC')
      .limit(100),
})
export class TrendingUserPost {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  tagsStr: string;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  r: number;
}
