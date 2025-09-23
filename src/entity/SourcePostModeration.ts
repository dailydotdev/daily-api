import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post, PostType } from './posts';
import type { Source } from './Source';
import type { User } from './user';
import type { PollOption } from './polls/PollOption';

export enum SourcePostModerationStatus {
  Approved = 'approved',
  Rejected = 'rejected',
  Pending = 'pending',
}

export enum PostModerationReason {
  OffTopic = 'OFF_TOPIC',
  Violation = 'VIOLATION',
  Promotional = 'PROMOTIONAL',
  Duplicate = 'DUPLICATE',
  LowQuality = 'LOW_QUALITY',
  NSFW = 'NSFW',
  Spam = 'SPAM',
  Misinformation = 'MISINFORMATION',
  Copyright = 'COPYRIGHT',
  Other = 'OTHER',
}

export const rejectReason: Record<PostModerationReason, string> = {
  [PostModerationReason.OffTopic]: 'Off-topic post unrelated to the Squad',
  [PostModerationReason.Violation]: 'Violates the Squad’s code of conduct',
  [PostModerationReason.Promotional]: 'Too promotional without adding value',
  [PostModerationReason.Duplicate]:
    'Duplicate or similar content already posted',
  [PostModerationReason.LowQuality]: 'Lacks quality or clarity',
  [PostModerationReason.NSFW]: 'Inappropriate, NSFW or offensive post',
  [PostModerationReason.Spam]: 'Post is spam or scam',
  [PostModerationReason.Misinformation]:
    'Contains misleading or false information',
  [PostModerationReason.Copyright]: 'Copyright or privacy violation',
  [PostModerationReason.Other]: 'Other',
};

export enum WarningReason {
  MultipleSquadPost = 'multiple_squad_post',
  DuplicatedInSameSquad = 'duplicated_in_squad',
}

export type SourcePostModerationFlags = Partial<{
  vordr: boolean;
  warningReason: WarningReason;
}>;

export type CreatePollOption = Pick<PollOption, 'text' | 'order'>;

@Entity()
@Index(['sourceId'])
@Index(['sourceId', 'createdById'])
export class SourcePostModeration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  sourceId: string;

  @ManyToOne('Source', (source: Source) => source.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  status: SourcePostModerationStatus;

  @Column({ type: 'text' })
  createdById: string;

  @ManyToOne('User', (user: User) => user.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  createdBy: Promise<User>;

  @Column({ type: 'text', nullable: true })
  moderatedById?: string | null;

  @ManyToOne('User', (user: User) => user.id, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  moderatedBy: Promise<User>;

  @Column({ type: 'text', nullable: true })
  moderatorMessage?: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: PostModerationReason | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', nullable: true })
  postId?: string | null;

  @ManyToOne('Post', (post: Post) => post.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @Column({ type: 'text' })
  type: PostType;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text', nullable: true })
  titleHtml?: string | null;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'text', nullable: true })
  contentHtml?: string | null;

  @Column({ type: 'text', nullable: true })
  image?: string | null;

  @Column({ type: 'text', nullable: true })
  sharedPostId?: string | null;

  @ManyToOne('Post', (post: Post) => post.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  sharedPost?: Promise<Post>;

  @Column({ type: 'text', nullable: true })
  externalLink?: string | null;

  @Column({ type: 'jsonb', default: {} })
  @Index('IDX_source_post_moderation_flags_vordr', { synchronize: false })
  flags: SourcePostModerationFlags;

  @Column({ type: 'jsonb', default: [] })
  pollOptions?: CreatePollOption[];

  @Column({ type: 'integer', default: null })
  duration?: number | null;
}
