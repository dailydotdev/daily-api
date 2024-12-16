import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './user';

export enum FeedOrderBy {
  Upvotes = 'upvotes',
  Downvotes = 'downvotes',
  Comments = 'comments',
  Clicks = 'clicks',
}

export type FeedFlags = Partial<{
  name: string;
  orderBy: FeedOrderBy;
  maxDayRange: number;
  minUpvotes: number;
  minViews: number;
  disableEngagementFilter: boolean;
  icon: string;
}>;

export type FeedFlagsPublic = Pick<
  FeedFlags,
  | 'name'
  | 'orderBy'
  | 'maxDayRange'
  | 'minUpvotes'
  | 'minViews'
  | 'disableEngagementFilter'
  | 'icon'
>;

export enum FeedType {
  Main = 'main',
  Custom = 'custom',
}

@Entity()
@Index('IDX_feed_id_user_id', ['id', 'userId'], { unique: true })
export class Feed {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  @Index()
  userId: string;

  @Column({ default: () => 'now()', update: false })
  createdAt: Date;

  @Column({ type: 'jsonb', default: {} })
  flags: FeedFlags = {};

  @Column({
    type: 'text',
    update: false,
    insert: false,
    nullable: false,
    unique: true,
    generatedType: 'STORED',
    asExpression: `trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(feed.flags->>'name',100),'')||'-'||feed.id)), '[^a-z0-9-]+', '-', 'gi'))`,
  })
  @Index('IDX_feed_slug', { unique: true })
  slug: string;

  @Column({
    type: 'text',
    update: false,
    insert: false,
    nullable: false,
    unique: false,
    generatedType: 'STORED',
    asExpression: `CASE WHEN "id" = "userId" THEN 'main' ELSE 'custom' END`,
  })
  type: FeedType;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
