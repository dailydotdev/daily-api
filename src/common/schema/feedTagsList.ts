import { z } from 'zod';

export const FEED_TAGS_LIST_MAX_LIMIT = 10;

export const feedTagsListInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(FEED_TAGS_LIST_MAX_LIMIT)
    .default(FEED_TAGS_LIST_MAX_LIMIT),
});
