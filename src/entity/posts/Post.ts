import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  TableInheritance,
} from 'typeorm';
import { type Source, UNKNOWN_SOURCE } from '../Source';
import type { PostTag } from '../PostTag';
import type { PostKeyword } from '../PostKeyword';
import type { User } from '../user/User';
import type { PostRelation } from './PostRelation';
import type { PostCodeSnippet } from './PostCodeSnippet';
import type { ContentLanguage } from '../../types';

export enum PostType {
  Article = 'article',
  Share = 'share',
  Freeform = 'freeform',
  Welcome = 'welcome',
  Collection = 'collection',
  VideoYouTube = 'video:youtube',
  Brief = 'brief',
  Poll = 'poll',
}

export const postTypes: string[] = Object.values(PostType);

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
  promoteToPublic: number | null;
  deletedBy: string;
  vordr: boolean;
  coverVideo: string;
  campaignId: string | null;
  originalUrl: string;
  posts: number;
  sources: number;
  savedTime: number;
  generatedAt: Date;
  dedupKey: string;
  // Recommendation signals
  specificity: string;
  intent: string;
  // Quality signals
  substanceDepth: string;
  titleContentAlignment: string;
  selfPromotionScore: number;
}>;

export type PostFlagsPublic = Pick<
  PostFlags,
  | 'private'
  | 'promoteToPublic'
  | 'coverVideo'
  | 'posts'
  | 'sources'
  | 'savedTime'
  | 'generatedAt'
>;

export type PostContentQuality = Partial<{
  is_ai_probability: number;
  is_clickbait_probability: number;
  manual_clickbait_probability: number;
}>;

export const translateablePostFields = [
  'title',
  'smartTitle',
  'titleHtml',
  'summary',
] as const;
export type TranslateablePostField = (typeof translateablePostFields)[number];
export type PostTranslation = {
  [key in TranslateablePostField]?: string;
};

@Entity()
@Index('IDX_post_id_sourceid', ['id', 'sourceId'])
@Index('IDX_post_deleted_visible_type_views', [
  'deleted',
  'visible',
  'type',
  'views',
])
@Index('IDX_post_source_id_pinned_at_created_at', [
  'sourceId',
  'pinnedAt',
  'createdAt',
])
@Index('IDX_post_source_id_pinned_at_null_pinned_at_created_at', {
  synchronize: false,
})
@Index('IDX_post_visible_metadatachanged', ['visible', 'metadataChangedAt'])
@Index('IDX_post_visible_sourceid', ['visible', 'sourceId'])
@Index('IDX_post_visible_type', ['visible', 'type'])
@Index('IDX_post_visible_deleted_id', ['visible', 'deleted', 'id'])
@Index('IDX_post_deleted_visible_banned_showonfeed_id_type', [
  'deleted',
  'visible',
  'banned',
  'showOnFeed',
  'id',
  'type',
])
@Index('IDX_post_visible_deleted_createdat', [
  'visible',
  'deleted',
  'createdAt',
])
@Index('IDX_post_sourceid_createdat', ['sourceId', 'createdAt'])
@Index('IDX_post_sourceid_deleted', ['sourceId', 'deleted'])
@TableInheritance({
  column: { type: 'varchar', name: 'type', default: PostType.Article },
})
export class Post {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ default: PostType.Article })
  type: PostType;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text', nullable: true })
  titleHtml?: string | null;

  @Column({ length: 14 })
  @Index('IDX_post_shortid', { unique: true })
  shortId: string;

  @Column({ default: () => 'now()' })
  @Index('IDX_post_createdAt', { synchronize: false })
  createdAt: Date;

  @Column({ default: () => 'now()' })
  @Index('IDX_post_metadataChangedAt')
  metadataChangedAt: Date;

  @Column({ default: () => 'now()' })
  statsUpdatedAt: Date;

  @Column({ type: 'text', default: UNKNOWN_SOURCE })
  sourceId: string;

  @ManyToOne('Source', (source: Source) => source.posts, {
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

  @OneToMany('PostTag', (tag: PostTag) => tag.post, { lazy: true })
  tags: Promise<PostTag[]>;

  @OneToMany('PostKeyword', (keyword: PostKeyword) => keyword.post, {
    lazy: true,
  })
  keywords: Promise<PostKeyword[]>;

  @Column({ type: 'text', nullable: true })
  @Index('IDX_tags')
  tagsStr: string | null;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_upvotes')
  upvotes: number;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_comments')
  comments: number;

  @Column({ length: 36, nullable: true })
  @Index('IDX_post_scout')
  scoutId: string | null;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'SET NULL',
  })
  scout: Promise<User>;

  @Column({ length: 36, nullable: true })
  @Index('IDX_post_author')
  authorId: string | null;

  @ManyToOne('User', {
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
  lastTrending?: Date;

  @Column({ type: 'integer', nullable: true })
  @Index('IDX_post_discussion_score')
  discussionScore?: number;

  @Column({ default: false })
  @Index('IDX_post_banned')
  banned: boolean;

  @Column({ default: false })
  deleted: boolean;

  @Column({ nullable: true, type: 'tsvector', select: false })
  @Index('IDX_post_tsv', { synchronize: false })
  tsv: string;

  @Column({ default: false })
  private: boolean;

  @Column({ default: true })
  visible: boolean;

  @Column({ type: 'timestamp', default: null })
  visibleAt: Date | null;

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

  @Column({ type: 'text', nullable: true, default: 'en' })
  language: string;

  @Column({ type: 'jsonb', default: {} })
  @Index('IDX_post_flags_sentAnalyticsReport', { synchronize: false })
  @Index('IDX_post_flags_banned', { synchronize: false })
  @Index('IDX_post_flags_deleted', { synchronize: false })
  @Index('IDX_post_flags_promoteToPublic', { synchronize: false })
  @Index('IDX_post_flags_vordr', { synchronize: false })
  flags: PostFlags;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_yggdrasil_id', {
    unique: true,
  })
  yggdrasilId: string;

  @OneToMany(
    'PostRelation',
    (postRelation: PostRelation) => postRelation.post,
    {
      lazy: true,
    },
  )
  public relatedPosts: Promise<PostRelation[]>;

  @Column({
    type: 'text',
    update: false,
    insert: false,
    nullable: false,
    unique: true,
    generatedType: 'STORED',
    asExpression: `trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(post.title,100),'')||'-'||post.id)), '[^a-z0-9-]+', '-', 'gi'))`,
  })
  @Index('IDX_post_slug', { unique: true })
  slug: string;

  @Column({ type: 'jsonb', default: {} })
  contentMeta: object;

  @Column({ type: 'jsonb', default: {} })
  contentQuality: PostContentQuality;

  @Column({ type: 'jsonb', default: {} })
  translation: Partial<Record<ContentLanguage, PostTranslation>>;

  @OneToMany(
    'PostCodeSnippet',
    (postCodeSnippet: PostCodeSnippet) => postCodeSnippet.post,
    {
      lazy: true,
    },
  )
  public codeSnippets: Promise<PostCodeSnippet[]>;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_awards')
  awards: number;
}
