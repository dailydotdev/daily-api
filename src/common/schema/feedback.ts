import { z } from 'zod';

const feedbackCategories = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export const feedbackCategorySchema = z.literal(feedbackCategories);

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
