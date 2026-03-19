import { z } from 'zod';

export const channelHighlightModes = ['disabled', 'shadow', 'publish'] as const;
export type ChannelHighlightMode = (typeof channelHighlightModes)[number];

export const channelHighlightStatuses = [
  'active',
  'published',
  'dropped',
] as const;
export type ChannelHighlightStatus = (typeof channelHighlightStatuses)[number];

export const storedHighlightStorySchema = z.object({
  storyKey: z.string().min(1),
  canonicalPostId: z.string().min(1),
  collectionId: z.string().min(1).nullable(),
  memberPostIds: z.array(z.string().min(1)).min(1),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  lastLlmEvaluatedAt: z.string().datetime().nullable().optional(),
  lastSignificanceScore: z.number().min(0).max(1).nullable().optional(),
  lastSignificanceLabel: z.string().min(1).nullable().optional(),
  lastHeadline: z.string().min(1).max(200).nullable().optional(),
  status: z.enum(channelHighlightStatuses).default('active'),
});

export const channelHighlightCandidatePoolSchema = z.object({
  stories: z.array(storedHighlightStorySchema).default([]),
});

export type StoredHighlightStory = z.infer<typeof storedHighlightStorySchema>;
export type ChannelHighlightCandidatePool = z.infer<
  typeof channelHighlightCandidatePoolSchema
>;

export const emptyChannelHighlightCandidatePool =
  (): ChannelHighlightCandidatePool => ({
    stories: [],
  });
