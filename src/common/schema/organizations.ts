import z from 'zod';
import { SubscriptionCycles } from '../../paddle';
import { SubscriptionProvider, SubscriptionStatus } from '../plus';

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
  LinkedIn = 'linkedin',
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
  title: z.string().nullable(),
  link: z.url(),
};

export const organizationLinksSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(OrganizationLinkType.Social),
    socialType: z
      .enum(SocialMediaType, {
        error: 'Invalid social media type',
      })
      .nullable(),
    ...linksSchemaBase,
  }),
  z.object({
    type: z.enum([OrganizationLinkType.Custom, OrganizationLinkType.Press]),
    socialType: z.null(),
    ...linksSchemaBase,
  }),
]);

export const recruiterOrganizationEditSchema = z
  .object({
    id: z.uuid('Organization ID must be a valid UUID'),
    name: z.string().nonempty().max(60),
    website: z.string().max(500).nullish(),
    description: z.string().max(2000).nullish(),
    perks: z.array(z.string().max(240)).max(50).nullish(),
    founded: z.number().int().min(1800).max(2100).nullish(),
    externalLocationId: z.string().max(500).nullish(),
    category: z.string().max(240).nullish(),
    size: z.number().int().nullish(),
    stage: z.number().int().nullish(),
    links: z.array(organizationLinksSchema).max(50).optional(),
  })
  .partial()
  .required({ id: true });
