import { z } from 'zod';

const feedbackCategories = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export const feedbackCategorySchema = z.literal(feedbackCategories);

export const feedbackClientInfoSchema = z.object({
  viewport: z.string().nullish(),
  screen: z.string().nullish(),
  timezone: z.string().nullish(),
  language: z.string().nullish(),
  platform: z.string().nullish(),
  theme: z.string().nullish(),
});

export const feedbackInputSchema = z.object({
  category: feedbackCategorySchema,
  description: z
    .string()
    .trim()
    .min(1, 'Description cannot be empty')
    .max(2000),
  pageUrl: z.string().nullish(),
  userAgent: z.string().nullish(),
  clientInfo: feedbackClientInfoSchema.nullish(),
  screenshotUrl: z.url().nullish(),
});

export const feedbackReplySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  authorName: z.string().trim().max(100).nullish(),
  authorEmail: z.email().nullish(),
});
