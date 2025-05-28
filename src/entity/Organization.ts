import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SubscriptionCycles } from '../paddle';
import type { SubscriptionProvider, SubscriptionStatus } from '../common/plus';
import type { ContentPreferenceOrganization } from './contentPreference/ContentPreferenceOrganization';

export type OrganizationSubscriptionFlags = Partial<{
  subscriptionId: string;
  priceId: string;
  cycle: SubscriptionCycles;
  createdAt: Date;
  provider: SubscriptionProvider;
  status: SubscriptionStatus;
}>;

@Entity()
@Index('IDX_organization_subflags_subscriptionid', { synchronize: false })
export class Organization {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_organization_organization_id',
  })
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  image: string;

  @Column({ type: 'smallint', default: 1 })
  seats: number;

  @Column({ type: 'jsonb', default: {} })
  subscriptionFlags?: OrganizationSubscriptionFlags;

  @OneToMany(
    'ContentPreferenceOrganization',
    (sm: ContentPreferenceOrganization) => sm.organization,
    { lazy: true },
  )
  members: Promise<ContentPreferenceOrganization[]>;
}
