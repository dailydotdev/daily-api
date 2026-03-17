import { z } from 'zod';

export const postHighlightItemSchema = z.object({
  postId: z.string().min(1),
  rank: z.number().int().min(1),
  headline: z.string().min(1).max(200),
});

export const setHighlightsSchema = z
  .array(postHighlightItemSchema)
  .min(1)
  .max(20);

export const updateHighlightSchema = z.object({
  rank: z.number().int().min(1).optional(),
  headline: z.string().min(1).max(200).optional(),
});
