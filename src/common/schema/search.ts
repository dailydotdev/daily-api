import { z } from 'zod';

export const searchSourcePostsSchema = z.object({
  source: z.string().min(1),
  query: z.string().min(1),
});
