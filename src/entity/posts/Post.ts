import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  TableInheritance,
} from 'typeorm';
import { Source, UNKNOWN_SOURCE } from '../Source';
import { PostTag } from '../PostTag';
import { PostKeyword } from '../PostKeyword';
import { User } from '../User';
import { PostRelation } from './PostRelation';

export enum PostType {
  Article = 'article',
  Share = 'share',
  Freeform = 'freeform',
  Welcome = 'welcome',
  Collection = 'collection',
}

export enum PostOrigin {
  CommunityPicks = 'community_picks',
  Squad = 'squads',
  UserGenerated = 'user_generated',
  Crawler = 'crawler',
}

export type PostFlags = Partial<{
  sentAnalyticsReport: boolean;
  banned: boolean;
  deleted: boolean;
  private: boolean;
  visible: boolean;
  showOnFeed: boolean;
  promoteToPublic: number;
}>;

export type PostFlagsPublic = Pick<PostFlags, 'private' | 'promoteToPublic'>;

@Entity()
@Index('IDX_post_source_id_pinned_at_created_at', [
  'sourceId',
  'pinnedAt',
  'createdAt',
])
@TableInheritance({
  column: { type: 'varchar', name: 'type', default: PostType.Article },
})
export class Post {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ default: PostType.Article })
  type: PostType;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  titleHtml?: string;

  @Column({ length: 14 })
  @Index('IDX_post_shortid', { unique: true })
  shortId: string;

  @Column({ default: () => 'now()' })
  @Index('IDX_post_createdAt', { synchronize: false })
  createdAt: Date;

  @Column({ default: () => 'now()' })
  @Index('IDX_post_metadataChangedAt')
  metadataChangedAt: Date;

  @Column({ type: 'text', default: UNKNOWN_SOURCE })
  @Index()
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.posts, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ default: 0 })
  @Index('IDX_post_views')
  views: number;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_score', { synchronize: false })
  score: number;

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
  @Index('IDX_post_scout')
  scoutId: string | null;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  scout: Promise<User>;

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

  @Column({ default: false })
  @Index('IDX_post_deleted')
  deleted: boolean;

  @Column({ nullable: true, type: 'tsvector', select: false })
  @Index('IDX_post_tsv')
  tsv: unknown;

  @Column({ default: false })
  private: boolean;

  @Column({ default: true })
  visible: boolean;

  @Column({ default: null })
  visibleAt: Date;

  @Column({ default: null })
  @Index()
  pinnedAt?: Date;

  @Column({ default: null, type: 'text' })
  origin: PostOrigin;

  @Column({ type: 'text', array: true, default: [] })
  contentCuration: string[];

  @Column({ default: true })
  showOnFeed: boolean;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_downvotes')
  downvotes: number;

  @Column({ type: 'jsonb', default: {} })
  @Index('IDX_post_flags_sentAnalyticsReport', { synchronize: false })
  @Index('IDX_post_flags_banned', { synchronize: false })
  @Index('IDX_post_flags_deleted', { synchronize: false })
  @Index('IDX_post_flags_promoteToPublic', { synchronize: false })
  flags: PostFlags;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_yggdrasil_id')
  yggdrasilId: string;

  @OneToMany(() => PostRelation, (postRelation) => postRelation.post, {
    lazy: true,
  })
  public relatedPosts: Promise<PostRelation[]>;
}
