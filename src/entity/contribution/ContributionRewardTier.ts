import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ContributionRewardType {
  Cores = 'cores',
  PlusDays = 'plus_days',
  StoreDiscount = 'store_discount',
  SuggestCauses = 'suggest_causes',
  Council = 'council',
  PatchyPicture = 'patchy_picture',
  Joke = 'joke',
  Trivia = 'trivia',
  Call = 'call',
  Privilege = 'privilege',
  Custom = 'custom',
}

@Entity()
@Index('IDX_contribution_reward_tier_active_sort', [
  'active',
  'sortOrder',
  'createdAt',
])
export class ContributionRewardTier {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_reward_tier_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'integer' })
  thresholdPoints: number;

  @Column({ type: 'text' })
  rewardType: ContributionRewardType;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}
