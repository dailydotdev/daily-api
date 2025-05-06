import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';
import type { Comment } from '../Comment';
import { UserVote } from '../../types';
import type { UserTransaction } from './UserTransaction';

export type UserCommentFlags = Partial<{
  awardId: string;
}>;

@Entity()
@Index(['commentId', 'userId'], { unique: true })
@Index(['userId', 'vote', 'votedAt'])
@Index('idx_user_comment_flags_awardId', { synchronize: false })
export class UserComment {
  get awarded(): boolean {
    return !!this.awardTransactionId;
  }

  @PrimaryColumn({ type: 'text' })
  commentId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: null, nullable: true })
  votedAt: Date;

  @Column({ type: 'smallint', default: UserVote.None })
  vote: UserVote = UserVote.None;

  @Column({ type: 'jsonb', default: {} })
  flags: UserCommentFlags = {};

  @ManyToOne('Comment', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  comment: Promise<Comment>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ type: 'uuid', nullable: true })
  @Index({ unique: true })
  awardTransactionId: string | null;

  @ManyToOne('UserTransaction', {
    lazy: true,
    onDelete: 'SET NULL',
  })
  awardTransaction: Promise<UserTransaction>;
}
