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
      .addSelect('p.upvotes - p.downvotes', 'r')
      .from('post', 'p')
      .innerJoin('source', 's', 's.id = p."sourceId"')
      .where(
        'not p.private and p."createdAt" > now() - interval \'60 day\' and p.upvotes > p.downvotes',
      )
      .andWhere('s.type = :type', { type: SourceType.User })
      .orderBy('r', 'DESC')
      .limit(1000),
})
export class PopularUserPost {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  tagsStr: string;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  r: number;
}
