import {
  Entity,
  ManyToOne,
  PrimaryColumn,
  Column,
  BeforeInsert,
} from 'typeorm';
import type { User } from './user';

export enum ReputationReason {
  PostDownvoted = 'post_downvoted',
  PostUpvoted = 'post_upvoted',
  PostBanned = 'post_banned',
  CommentUpvoted = 'comment_upvoted',
  PostReportConfirmed = 'post_report_confirmed',
  SourceRequestApproved = 'source_request_approved',
  CommentDownvoted = 'comment_downvoted',
  StreakRecover = 'streak_recover',
  StreakFirstRecovery = 'streak_recover_for_free',
}

export enum ReputationType {
  Post = 'post',
  Comment = 'comment',
  Source = 'source',
  Streak = 'streak',
}

export const reputationReasonAmount: Record<ReputationReason, number> = {
  [ReputationReason.PostDownvoted]: -10,
  [ReputationReason.PostUpvoted]: 10,
  [ReputationReason.PostBanned]: -100,
  [ReputationReason.CommentUpvoted]: 50,
  [ReputationReason.PostReportConfirmed]: 100,
  [ReputationReason.SourceRequestApproved]: 200,
  [ReputationReason.CommentDownvoted]: -50,
  [ReputationReason.StreakRecover]: -25,
  [ReputationReason.StreakFirstRecovery]: 0,
};

export const REPUTATION_THRESHOLD = parseInt(
  process.env.REPUTATION_THRESHOLD || '250',
);

@Entity()
export class ReputationEvent {
  @PrimaryColumn({ length: 36, default: '' })
  grantById: string;

  @PrimaryColumn({ length: 36 })
  grantToId: string;

  @PrimaryColumn({ length: 36 })
  targetId: string;

  @PrimaryColumn({ length: 36 })
  reason: ReputationReason;

  @PrimaryColumn({ length: 36 })
  targetType: ReputationType;

  @Column()
  amount: number;

  @Column({ default: () => 'now()' })
  timestamp: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  grantTo: Promise<User>;

  @BeforeInsert()
  setAmount(): void {
    this.amount = reputationReasonAmount[this.reason];
  }
}
