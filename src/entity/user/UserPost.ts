import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from '../posts/Post';
import type { User } from './User';
import { UserVote } from '../../types';
import type { UserTransaction } from './UserTransaction';
import type { PollOption } from '../polls/PollOption';

export type UserPostFlags = Partial<{
  feedbackDismiss: boolean;
  awardId: string;
}>;

export type UserPostFlagsPublic = Pick<UserPostFlags, 'feedbackDismiss'>;

@Entity()
@Index(['postId', 'userId'], { unique: true })
@Index(['userId', 'vote', 'votedAt'])
@Index('IDX_user_post_postid_userid_hidden', ['postId', 'userId', 'hidden'])
@Index('idx_user_post_flags_awardId', { synchronize: false })
export class UserPost {
  get awarded(): boolean {
    return !!this.awardTransactionId;
  }

  @PrimaryColumn({ type: 'text' })
  postId: string;

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

  @Column({ type: 'boolean', default: false })
  hidden = false;

  @Column({ type: 'jsonb', default: {} })
  flags: UserPostFlags = {};

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

  @Column({ type: 'uuid', nullable: true })
  @Index({ unique: true })
  awardTransactionId: string | null;

  @ManyToOne('UserTransaction', {
    lazy: true,
    onDelete: 'SET NULL',
  })
  awardTransaction: Promise<UserTransaction>;

  @Column({ type: 'uuid', nullable: true })
  pollVoteOptionId: string | null;

  @ManyToOne('PollOption', {
    lazy: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'pollVoteOptionId',
    foreignKeyConstraintName: 'FK_user_post_poll_vote_option_id',
  })
  pollVoteOption: Promise<PollOption>;
}
