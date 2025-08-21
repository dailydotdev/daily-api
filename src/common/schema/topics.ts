import z from 'zod';

export const postMetricsUpdatedTopic = z.object({
  postId: z.string(),
  payload: z.object({
    upvotes: z.coerce.number().int().optional(),
    downvotes: z.coerce.number().int().optional(),
    comments: z.coerce.number().int().optional(),
    awards: z.coerce.number().int().optional(),
  }),
});
