import { DataSource, Index, ViewColumn, ViewEntity } from 'typeorm';
import { Post } from './posts/Post';
import { PostKeyword } from './PostKeyword';
import { ChannelDigest } from './ChannelDigest';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('pk.keyword', 'keyword')
      .addSelect('cd.channel', 'channel')
      .addSelect('count(*)', 'posts')
      .from(PostKeyword, 'pk')
      .innerJoin(
        Post,
        'p',
        `p.id = pk."postId" AND p.deleted = false AND p.visible = true AND p.private = false AND p."createdAt" > now() - interval '48 hours'`,
      )
      .innerJoin(
        ChannelDigest,
        'cd',
        `cd.enabled = true AND (p."contentMeta"->'channels') ? cd.channel`,
      )
      .groupBy('pk.keyword')
      .addGroupBy('cd.channel'),
})
@Index('UQ_keyword_channel_keyword_channel', ['keyword', 'channel'], {
  unique: true,
})
export class KeywordChannel {
  @ViewColumn()
  keyword: string;

  @ViewColumn()
  channel: string;

  @ViewColumn()
  posts: number;
}
