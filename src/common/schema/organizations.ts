import z from 'zod';
import { SubscriptionCycles } from '../../paddle';
import { SubscriptionProvider, SubscriptionStatus } from '../plus';
import { CompanySize, CompanyStage } from '@dailydotdev/schema';

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
  link: z.url(),
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

export const organizationSchema = z.object({
  id: z.string(),
  createdAt: z.string().transform((str) => new Date(str)),
  updatedAt: z.string().transform((str) => new Date(str)),
  name: z.string(),
  image: z.string().nullable(),
  seats: z.number().min(1),
  subscriptionFlags: organizationSubscriptionFlagsSchema,
  links: z.array(organizationLinksSchema),
  website: z.url().nullable(),
  description: z.string().nullable(),
  perks: z.array(z.string()).nullable(),
  founded: z.number().int().min(1000).max(new Date().getFullYear()).nullable(),
  location: z.string().nullable(),
  size: z.enum(CompanySize, { error: 'Invalid company size' }).nullable(),
  category: z.string().nullable(),
  stage: z
    .enum(CompanyStage, {
      error: 'Invalid company stage',
    })
    .nullable(),
});
