import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Post } from './posts';
import type { User } from './user';
import type { UserTransaction } from './user/UserTransaction';

export type CommentFlags = Partial<{
  vordr: boolean;
  awardId: string;
}>;

export type CommentFlagsPublic = Pick<CommentFlags, 'awardId'>;

@Entity()
@Index('idx_comment_flags_awardId', { synchronize: false })
export class Comment {
  get awarded(): boolean {
    return !!this.awardTransactionId;
  }

  @PrimaryColumn({ length: 14 })
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_comment_post_id')
  postId: string;

  @Column({ length: 36 })
  @Index('IDX_comment_user_id')
  userId: string;

  @Column({ length: 14, nullable: true })
  @Index('IDX_comment_parent_id')
  parentId: string | null;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ nullable: true })
  lastUpdatedAt: Date;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text' })
  contentHtml: string;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_comment_upvotes')
  upvotes: number;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_comment_downvotes')
  downvotes: number;

  @Column({ type: 'integer', default: 0 })
  comments: number;

  @Column({ default: false })
  featured: boolean;

  @Column({ type: 'jsonb', default: {} })
  @Index('IDX_comment_flags_vordr', { synchronize: false })
  flags: CommentFlags;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @ManyToOne(() => Comment, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  parent: Promise<Comment>;

  @Column({ type: 'uuid', nullable: true })
  @Index({ unique: true })
  awardTransactionId: string | null;

  @ManyToOne('UserTransaction', {
    lazy: true,
    onDelete: 'SET NULL',
  })
  awardTransaction: Promise<UserTransaction>;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_comment_awards')
  awards: number;
}
