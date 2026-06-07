import { z } from 'zod';

export const updatePostContentSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1),
  mode: z.enum(['append', 'prepend', 'replace']).default('replace'),
  title: z.string().min(1).optional(),
});

const MAX_BRIEF_WORTHY_BATCH_SIZE = 500;

export const updatePostsBriefWorthySchema = z.object({
  postIds: z
    .array(z.string().trim().min(1))
    .min(1, { error: 'At least one post ID is required' })
    .max(MAX_BRIEF_WORTHY_BATCH_SIZE, {
      error: `Maximum of ${MAX_BRIEF_WORTHY_BATCH_SIZE} post IDs can be processed at once`,
    }),
  briefWorthy: z.boolean(),
});
