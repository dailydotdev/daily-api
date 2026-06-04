import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { ContributionCause } from './ContributionCause';
import type { User } from '../user/User';

@Entity()
@Index('IDX_user_contribution_cause_preference_causeId', ['causeId'])
export class UserContributionCausePreference {
  @PrimaryColumn({
    length: 36,
    primaryKeyConstraintName: 'PK_user_contribution_cause_preference',
  })
  userId: string;

  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_user_contribution_cause_preference',
  })
  causeId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('ContributionCause', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'causeId',
    foreignKeyConstraintName: 'FK_user_contribution_cause_preference_cause_id',
  })
  cause: Promise<ContributionCause>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_contribution_cause_preference_user_id',
  })
  user: Promise<User>;
}
