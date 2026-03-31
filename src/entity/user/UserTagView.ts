import { subDays } from 'date-fns';
import { DataSource, Index, ViewColumn, ViewEntity } from 'typeorm';
import { PostKeyword } from '../PostKeyword';
import { Post } from '../posts';

@ViewEntity({
  name: 'user_tag_view',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select(`p."authorId"`, 'userId')
      .addSelect('pk.keyword', 'tag')
      .addSelect('coalesce(sum(p.upvotes), 0)', 'count')
      .from(Post, 'p')
      .innerJoin(
        PostKeyword,
        'pk',
        'pk."postId" = p.id AND pk.status = :status',
        { status: 'allow' },
      )
      .where(`p."authorId" IS NOT NULL`)
      .andWhere(`p."createdAt" > :time`, {
        time: subDays(new Date(), 90),
      })
      .groupBy(`p."authorId", pk.keyword`),
})
@Index('UQ_userTag_userId_tag', ['userId', 'tag'], { unique: true })
export class UserTagView {
  @ViewColumn()
  @Index('IDX_userTag_userId')
  userId: string;

  @ViewColumn()
  @Index('IDX_userTag_tag')
  tag: string;

  @ViewColumn()
  count: number;
}
