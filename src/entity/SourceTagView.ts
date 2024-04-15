import { DataSource, Index, ViewColumn, ViewEntity } from 'typeorm';
import { Post } from './posts';
import { subDays } from 'date-fns';
import { PostKeyword } from './PostKeyword';
import { Source } from './Source';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select(`s.id as sourceId`)
      .addSelect('pk.keyword AS tag')
      .addSelect('count(pk.keyword) AS count')
      .from(Source, 's')
      .innerJoin(Post, 'p', `p.sourceId = s.id AND p.createdAt > :time`, {
        time: subDays(new Date(), 90),
      })
      .innerJoin(
        PostKeyword,
        'pk',
        'pk.postId = p.id AND pk.status = :status',
        { status: 'allow' },
      )
      .andWhere({ active: true, private: false })
      .groupBy(`sourceId, tag`),
})
export class SourceTagView {
  @ViewColumn()
  @Index('IDX_sourceTag_sourceId')
  sourceId: string;

  @ViewColumn()
  @Index('IDX_sourceTag_tag')
  tag: string;

  @ViewColumn()
  count: number;
}
