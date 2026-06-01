import { z } from 'zod';

export const FEED_BY_TAGS_MAX_TAGS = 20;

export const feedByTagsInputSchema = z.object({
  tags: z.array(z.string().min(1)).min(1).max(FEED_BY_TAGS_MAX_TAGS),
});
