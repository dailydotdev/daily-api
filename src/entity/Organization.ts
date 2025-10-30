import { z } from 'zod';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContentPreferenceOrganization } from './contentPreference/ContentPreferenceOrganization';
import type {
  organizationLinksSchema,
  organizationSubscriptionFlagsSchema,
} from '../common/schema/organizations';
import type { CompanySize, CompanyStage } from '@dailydotdev/schema';

export type OrganizationLink = z.infer<typeof organizationLinksSchema>;

@Entity()
@Index('IDX_organization_subflags_subscriptionid', { synchronize: false })
export class Organization {
  @PrimaryGeneratedColumn({
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
  links: OrganizationLink[];

  @Column({ type: 'text', default: null })
  website: string;

  @Column({ type: 'text', default: null })
  description: string;

  @Column({ type: 'text', array: true, default: null })
  perks: Array<string>;

  @Column({ type: 'int', default: null })
  founded: number;

  @Column({ type: 'text', default: null })
  location: string;

  @Column({ type: 'text', default: null })
  category: string;

  @Column({
    type: 'integer',
    default: null,
    comment: 'CompanySize from protobuf schema',
  })
  size: CompanySize;

  @Column({
    type: 'integer',
    default: null,
    comment: 'CompanyStage from protobuf schema',
  })
  stage: CompanyStage;

  @OneToMany(
    'ContentPreferenceOrganization',
    (sm: ContentPreferenceOrganization) => sm.organization,
    { lazy: true },
  )
  members: Promise<ContentPreferenceOrganization[]>;
}
