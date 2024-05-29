import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { Post } from './posts';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('"sourceId"')
      .addSelect('"tagsStr"')
      .addSelect('"contentCuration"')
      .addSelect('"createdAt"')
      .addSelect('upvotes - downvotes r')
      .from(Post, 'p')
      .where(
        'not p.private and p."createdAt" > now() - interval \'60 day\' and upvotes > downvotes and "type" = \'video:youtube\'',
      )
      .orderBy('r', 'DESC')
      .limit(1000),
})
export class PopularVideoPost {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  tagsStr: string;

  @ViewColumn()
  contentCuration: string;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  r: number;
}
