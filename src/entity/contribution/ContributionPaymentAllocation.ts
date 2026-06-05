import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ContributionCause } from './ContributionCause';
import type { ContributionPayment } from './ContributionPayment';
import type { User } from '../user/User';

@Entity()
@Index('IDX_contribution_payment_allocation_userId', ['userId'])
@Index('IDX_contribution_payment_allocation_causeId', ['causeId'])
@Index('IDX_contribution_payment_allocation_paymentId', ['paymentId'])
export class ContributionPaymentAllocation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_payment_allocation_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'uuid' })
  paymentId: string;

  @Column({ type: 'uuid' })
  causeId: string;

  @Column({ length: 36 })
  userId: string;

  @Column({ type: 'integer' })
  points: number;

  @Column({ type: 'integer' })
  amountCents: number;

  @ManyToOne('ContributionPayment', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'paymentId',
    foreignKeyConstraintName: 'FK_contribution_payment_allocation_payment_id',
  })
  payment: Promise<ContributionPayment>;

  @ManyToOne('ContributionCause', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'causeId',
    foreignKeyConstraintName: 'FK_contribution_payment_allocation_cause_id',
  })
  cause: Promise<ContributionCause>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_contribution_payment_allocation_user_id',
  })
  user: Promise<User>;
}
