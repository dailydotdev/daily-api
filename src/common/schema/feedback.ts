import { UserFeedbackCategory } from '@dailydotdev/schema';
import { z } from 'zod';

export const feedbackCategorySchema = z.enum(UserFeedbackCategory);

export const feedbackInputSchema = z.object({
  category: feedbackCategorySchema,
  description: z
    .string()
    .trim()
    .min(1, 'Description cannot be empty')
    .max(2000),
  pageUrl: z.string().nullish(),
  userAgent: z.string().nullish(),
  consoleLogs: z
    .string()
    .max(51200, 'Console logs exceed 50KB limit')
    .nullish(),
});
