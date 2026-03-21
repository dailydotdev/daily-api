import { z } from 'zod';

export const postHighlightItemSchema = z.object({
  postId: z.string().min(1),
  headline: z.string().min(1).max(200),
  rank: z.number().int().min(1).optional(),
  highlightedAt: z.string().datetime().optional(),
  significanceLabel: z.string().min(1).optional().nullable(),
  reason: z.string().min(1).optional().nullable(),
});

export const setHighlightsSchema = z.array(postHighlightItemSchema).max(20);

export const updateHighlightSchema = z.object({
  rank: z.number().int().min(1).optional(),
  highlightedAt: z.string().datetime().optional(),
  headline: z.string().min(1).max(200).optional(),
  significanceLabel: z.string().min(1).optional().nullable(),
  reason: z.string().min(1).optional().nullable(),
});
