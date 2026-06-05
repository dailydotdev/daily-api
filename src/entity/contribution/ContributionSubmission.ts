import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContributionAction } from './ContributionAction';
import type { ContributionPayment } from './ContributionPayment';
import type { User } from '../user/User';

export enum ContributionSubmissionStatus {
  Approved = 'approved',
  Flagged = 'flagged',
  Rejected = 'rejected',
}

@Entity()
@Index('IDX_contribution_submission_userId_actionId', ['userId', 'actionId'])
@Index('IDX_contribution_submission_status_paymentId', ['status', 'paymentId'])
@Index('IDX_contribution_submission_userId_status', ['userId', 'status'])
export class ContributionSubmission {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_submission_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ length: 36 })
  userId: string;

  @Column({ type: 'uuid' })
  actionId: string;

  @Column({ type: 'uuid', nullable: true, default: null })
  paymentId: string | null;

  @Column({ type: 'jsonb', default: {} })
  evidence: Record<string, unknown>;

  @Column({ type: 'text', default: ContributionSubmissionStatus.Approved })
  status: ContributionSubmissionStatus;

  @Column({ type: 'integer' })
  awardedPoints: number;

  @Column({ type: 'jsonb', default: {} })
  flags: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true, default: null })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true, default: null })
  reviewedBy: string | null;

  @ManyToOne('ContributionAction', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'actionId',
    foreignKeyConstraintName: 'FK_contribution_submission_action_id',
  })
  action: Promise<ContributionAction>;

  @ManyToOne('ContributionPayment', {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'paymentId',
    foreignKeyConstraintName: 'FK_contribution_submission_payment_id',
  })
  payment: Promise<ContributionPayment | null>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_contribution_submission_user_id',
  })
  user: Promise<User>;
}
