import { z } from 'zod';

export const feedbackCategorySchema = z.literal([0, 1, 2, 3, 4, 5, 6, 7]);

export const feedbackInputSchema = z.object({
  category: feedbackCategorySchema,
  description: z
    .string()
    .trim()
    .min(1, 'Description cannot be empty')
    .max(2000),
  pageUrl: z.string().nullish(),
  userAgent: z.string().nullish(),
  screenshotUrl: z.url().nullish(),
});
