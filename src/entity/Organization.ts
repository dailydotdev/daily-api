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
import { SubscriptionCycles } from '../paddle';
import { SubscriptionProvider, SubscriptionStatus } from '../common/plus';
import type { ContentPreferenceOrganization } from './contentPreference/ContentPreferenceOrganization';

export enum OrganizationLinkType {
  Custom = 'custom',
  Social = 'social',
  Press = 'press',
}

export enum SocialMediaType {
  Facebook = 'facebook',
  X = 'x',
  GitHub = 'github',
  Crunchbase = 'crunchbase',
}

export const organizationSubscriptionFlagsSchema = z.object({
  subscriptionId: z.string({
    error: 'Subscription ID is required',
  }),
  priceId: z.string({
    error: 'Price ID is required',
  }),
  cycle: z.enum(SubscriptionCycles, {
    error: 'Invalid subscription cycle',
  }),
  createdAt: z.preprocess(
    (value) => new Date(value as string),
    z.date().optional(),
  ),
  provider: z.enum(SubscriptionProvider, {
    error: 'Invalid subscription provider',
  }),
  status: z.enum(SubscriptionStatus, {
    error: 'Invalid subscription status',
  }),
});

const linksSchemaBase = {
  title: z.string(),
  link: z.string().url(),
};

export const organizationLinksSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(OrganizationLinkType.Social),
    socialType: z.enum(SocialMediaType, {
      error: 'Invalid social media type',
    }),
    ...linksSchemaBase,
  }),
  z.object({
    type: z.enum([OrganizationLinkType.Custom, OrganizationLinkType.Press]),
    socialType: z.null(),
    ...linksSchemaBase,
  }),
]);

export enum CompanySize {
  SIZE_1_10 = '1-10',
  SIZE_11_50 = '11-50',
  SIZE_51_200 = '51-200',
  SIZE_201_500 = '201-500',
  SIZE_501_1000 = '501-1000',
  SIZE_1001_5000 = '1001-5000',
  SIZE_5000_PLUS = '5000+',
}

export enum CompanyCategory {
  Software = 'Software',
  // TBD more complete list
}

export enum CompanyStage {
  PreSeed = 'pre_seed',
  Seed = 'seed',
  SeriesA = 'series_a',
  SeriesB = 'series_b',
  SeriesC = 'series_c',
  SeriesD = 'series_d',
  Public = 'public',
  Bootstrapped = 'bootstrapped',
  NonProfit = 'non_profit',
  Government = 'government',
}

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
  perks: string;

  @Column({ type: 'numeric', default: null })
  founded: number;

  @Column({ type: 'text', default: null })
  location: string;

  @Column({ type: 'text', default: null })
  size: CompanySize;

  @Column({ type: 'text', default: null })
  category: CompanyCategory;

  @Column({ type: 'text', default: null })
  stage: CompanyStage;

  @OneToMany(
    'ContentPreferenceOrganization',
    (sm: ContentPreferenceOrganization) => sm.organization,
    { lazy: true },
  )
  members: Promise<ContentPreferenceOrganization[]>;
}
