import z from 'zod';
import { SubscriptionCycles } from '../../paddle';
import { SubscriptionProvider, SubscriptionStatus } from '../plus';
import { OrganizationLinkType, SocialMediaType } from '@dailydotdev/schema';

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
    type: z.literal(OrganizationLinkType.SOCIAL),
    socialType: z.enum(SocialMediaType, {
      error: 'Invalid social media type',
    }),
    ...linksSchemaBase,
  }),
  z.object({
    type: z.union([
      z.literal(OrganizationLinkType.CUSTOM),
      z.literal(OrganizationLinkType.PRESS),
    ]),
    socialType: z.null(),
    ...linksSchemaBase,
  }),
]);
