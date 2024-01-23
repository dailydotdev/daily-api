import {
  Entity,
  ManyToOne,
  PrimaryColumn,
  Column,
  BeforeInsert,
} from 'typeorm';
import { User } from './user';

export enum ReputationReason {
  PostUpvoted = 'post_upvoted',
  PostBanned = 'post_banned',
  CommentUpvoted = 'comment_upvoted',
  PostReportConfirmed = 'post_report_confirmed',
  SourceRequestApproved = 'source_request_approved',
}

export enum ReputationType {
  Post = 'post',
  Comment = 'comment',
  Source = 'source',
}

const reputationReasonAmount: Record<ReputationReason, number> = {
  [ReputationReason.PostUpvoted]: 10,
  [ReputationReason.PostBanned]: -100,
  [ReputationReason.CommentUpvoted]: 50,
  [ReputationReason.PostReportConfirmed]: 100,
  [ReputationReason.SourceRequestApproved]: 200,
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

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  grantTo: Promise<User>;

  @BeforeInsert()
  setAmount(): void {
    this.amount = reputationReasonAmount[this.reason];
  }
}
