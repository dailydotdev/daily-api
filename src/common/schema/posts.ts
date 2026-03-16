import { z } from 'zod';

export const updatePostContentSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1),
  mode: z.enum(['append', 'prepend', 'replace']).default('replace'),
  title: z.string().min(1).optional(),
});
