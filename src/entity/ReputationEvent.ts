import {
  Entity,
  ManyToOne,
  PrimaryColumn,
  Column,
  BeforeInsert,
  Index,
} from 'typeorm';
import { User } from './User';

export enum ReputationReason {
  PostUpvote = 'post_upvote',
  PostBanned = 'post_banned',
  CommentUpvote = 'comment_upvote',
  PostReportConfirmed = 'post_report_confirmed',
  SourceRequestApproved = 'source_request_approved',
}

export enum ReputationType {
  Post = 'post',
  Comment = 'comment',
  Source = 'source',
}

const reputationReasonAmount: Record<ReputationReason, number> = {
  [ReputationReason.PostUpvote]: 10,
  [ReputationReason.PostBanned]: -100,
  [ReputationReason.CommentUpvote]: 50,
  [ReputationReason.PostReportConfirmed]: 100,
  [ReputationReason.SourceRequestApproved]: 200,
};

@Entity()
export class ReputationEvent {
  @PrimaryColumn({ default: () => 'now()' })
  timestamp: Date;

  @PrimaryColumn({ length: 36, default: '' })
  grantById: string;

  @Index()
  @PrimaryColumn({ length: 36 })
  grantToId: string;

  @PrimaryColumn({ length: 36 })
  targetId: string;

  @PrimaryColumn({ length: 36 })
  reason: ReputationReason;

  @PrimaryColumn({ length: 36, type: 'varchar' })
  targetType: ReputationType;

  @Column({ type: 'int' })
  amount: number;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  grantByUser?: Promise<User>;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  grantToUser?: Promise<User>;

  @BeforeInsert()
  setAmount(): void {
    this.amount = reputationReasonAmount[this.reason];
  }
}
