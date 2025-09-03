import { z } from 'zod';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContentPreferenceOrganization } from './contentPreference/ContentPreferenceOrganization';
import type {
  organizationLinksSchema,
  organizationSubscriptionFlagsSchema,
} from '../common/schema/organizations';
import type { CompanySize, CompanyStage } from '@dailydotdev/schema';

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
  subscriptionFlags: z.infer<typeof organizationSubscriptionFlagsSchema>;

  @Column({ type: 'jsonb', default: '[]' })
  links: z.infer<typeof organizationLinksSchema>;

  @Column({ type: 'text', default: null })
  website: string;

  @Column({ type: 'text', default: null })
  description: string;

  @Column({ type: 'text', array: true, default: null })
  perks: Array<string>;

  @Column({ type: 'numeric', default: null })
  founded: number;

  @Column({ type: 'text', default: null })
  location: string;

  @Column({ type: 'text', default: null })
  size: CompanySize;

  @Column({ type: 'text', default: null })
  category: string;

  @Column({ type: 'text', default: null })
  stage: CompanyStage;

  @OneToMany(
    'ContentPreferenceOrganization',
    (sm: ContentPreferenceOrganization) => sm.organization,
    { lazy: true },
  )
  members: Promise<ContentPreferenceOrganization[]>;
}
