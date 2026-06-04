import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContributionRewardTier } from './ContributionRewardTier';
import type { User } from '../user/User';

export enum UserContributionRewardStatus {
  Claimed = 'claimed',
  Fulfilled = 'fulfilled',
}

@Entity()
@Index('IDX_user_contribution_reward_userId_status', ['userId', 'status'])
export class UserContributionReward {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_user_contribution_reward',
  })
  tierId: string;

  @PrimaryColumn({
    length: 36,
    primaryKeyConstraintName: 'PK_user_contribution_reward',
  })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', default: UserContributionRewardStatus.Claimed })
  status: UserContributionRewardStatus;

  @Column({ type: 'timestamp', nullable: true, default: null })
  claimedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  fulfilledAt: Date | null;

  @ManyToOne('ContributionRewardTier', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'tierId',
    foreignKeyConstraintName: 'FK_user_contribution_reward_tier_id',
  })
  tier: Promise<ContributionRewardTier>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_contribution_reward_user_id',
  })
  user: Promise<User>;
}
