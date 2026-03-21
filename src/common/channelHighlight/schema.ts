import { z } from 'zod';

export const channelHighlightModes = ['disabled', 'shadow', 'publish'] as const;
export type ChannelHighlightMode = (typeof channelHighlightModes)[number];

export const channelHighlightSnapshotItemSchema = z.object({
  postId: z.string().min(1),
  headline: z.string().min(1).max(200),
  highlightedAt: z.string().datetime(),
  significanceLabel: z.string().min(1).nullable().optional(),
  reason: z.string().min(1).nullable().optional(),
});

export const channelHighlightSnapshotSchema = z.array(
  channelHighlightSnapshotItemSchema,
);

export type SerializedChannelHighlightSnapshotItem = z.infer<
  typeof channelHighlightSnapshotItemSchema
>;

export type SerializedChannelHighlightSnapshot = z.infer<
  typeof channelHighlightSnapshotSchema
>;
