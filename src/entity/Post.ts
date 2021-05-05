import {
  Column,
  Connection,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { SearchOptions } from '@algolia/client-search';
import { PostTag } from './PostTag';
import { Source } from './Source';
import { getPostsIndex, trackSearch } from '../common';
import { User } from './User';
import { PostKeyword } from './PostKeyword';

@Entity()
export class Post {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ length: 14 })
  @Index('IDX_post_shortid', { unique: true })
  shortId: string;

  @Column({ nullable: true })
  publishedAt?: Date;

  @Column({ default: () => 'now()' })
  @Index('IDX_post_createdAt', { synchronize: false })
  createdAt: Date;

  @Column({ type: 'text' })
  @Index()
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.posts, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  @Index()
  url: string;

  @Column({ type: 'text', nullable: true })
  @Index()
  canonicalUrl?: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'float', nullable: true })
  ratio?: number;

  @Column({ type: 'text', nullable: true })
  placeholder?: string;

  @Column({ default: false })
  tweeted: boolean;

  @Column({ default: 0 })
  @Index('IDX_post_views')
  views: number;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_score', { synchronize: false })
  score: number;

  @Column({ type: 'text', nullable: true })
  siteTwitter?: string;

  @Column({ type: 'text', nullable: true })
  creatorTwitter?: string;

  @Column({ nullable: true })
  readTime?: number;

  @OneToMany(() => PostTag, (tag) => tag.post, { lazy: true })
  tags: Promise<PostTag[]>;

  @OneToMany(() => PostKeyword, (keyword) => keyword.post, { lazy: true })
  keywords: Promise<PostKeyword[]>;

  @Column({ type: 'text', nullable: true })
  @Index('IDX_tags')
  tagsStr: string;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_upvotes')
  upvotes: number;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_comments')
  comments: number;

  @Column({ length: 36, nullable: true })
  @Index('IDX_post_author')
  authorId: string | null;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  author: Promise<User>;

  @Column({ default: true })
  @Index('IDX_user_sentAnalyticsReport')
  sentAnalyticsReport: boolean;

  @Column({ default: 0 })
  @Index('IDX_post_viewsThreshold')
  viewsThreshold: number;

  @Column({ nullable: true })
  @Index('IDX_post_trending')
  trending?: number;

  @Column({ nullable: true })
  @Index('IDX_post_last_trending')
  lastTrending?: Date;

  @Column({ type: 'integer', nullable: true })
  @Index('IDX_post_discussion_score')
  discussionScore?: number;

  @Column({ default: false })
  @Index('IDX_post_banned')
  banned: boolean;
}

export interface SearchPostsResult {
  id: string;
  title: string;
  highlight?: string;
}

export interface AlgoliaSearchResult {
  title: string;
  _highlightResult?: { title: { value: string } };
}

export const searchPosts = async (
  query: string,
  opts: SearchOptions,
  trackingId: string,
  ip: string,
): Promise<SearchPostsResult[]> => {
  const res = await getPostsIndex().search<AlgoliaSearchResult>(query, {
    headers: trackSearch(trackingId, ip),
    ...opts,
  });
  return res.hits.map(
    (hit): SearchPostsResult => ({
      id: hit.objectID,
      title: hit.title,
      highlight: hit?._highlightResult?.title.value,
    }),
  );
};

export type PostStats = {
  numPosts: number;
  numPostViews: number;
  numPostUpvotes: number;
};

export const getAuthorPostStats = (
  con: Connection,
  authorId: string,
): Promise<PostStats> =>
  con
    .createQueryBuilder()
    .select('count(*)', 'numPosts')
    .addSelect('sum(post.views)', 'numPostViews')
    .addSelect('sum(post.upvotes)', 'numPostUpvotes')
    .from(Post, 'post')
    .where({ authorId })
    .getRawOne<PostStats>();
