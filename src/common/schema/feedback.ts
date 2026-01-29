import { z } from 'zod';

export const feedbackCategorySchema = z.literal([
  'BUG',
  'FEATURE_REQUEST',
  'GENERAL',
  'OTHER',
]);

export const feedbackStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'spam',
]);

export const feedbackClassificationSchema = z.object({
  platform: z.string().nullish(),
  category: z.string().nullish(),
  sentiment: z.string().nullish(),
  urgency: z.string().nullish(),
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
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;
export type FeedbackClassification = z.infer<
  typeof feedbackClassificationSchema
>;
