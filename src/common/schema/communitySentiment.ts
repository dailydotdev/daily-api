import { z } from 'zod';

export const communitySentimentLeanValues = [
  'positive',
  'mixed',
  'skeptical',
  'heated',
] as const;

export const communitySentimentLeanSchema = z.enum(
  communitySentimentLeanValues,
);

export const communitySentimentBreakdownSchema = z
  .object({
    positive: z.number(),
    mixed: z.number(),
    critical: z.number(),
  })
  .refine(
    ({ positive, mixed, critical }) => positive + mixed + critical === 100,
    { message: 'breakdown percentages must sum to 100' },
  );

export const communitySentimentSourceSchema = z.object({
  source: z.string(),
  lean: communitySentimentLeanSchema,
  note: z.string().nullish(),
  url: z.string().nullish(),
});

export const communitySentimentHighlightMetricsSchema = z.object({
  points: z.number().nullish(),
  replies: z.number().nullish(),
  likes: z.number().nullish(),
});

export const communitySentimentHighlightSchema = z.object({
  quote: z.string(),
  author: z.string().nullish(),
  source: z.string(),
  url: z.string().nullish(),
  metrics: communitySentimentHighlightMetricsSchema.nullish(),
});

export const communitySentimentPayloadSchema = z.object({
  breakdown: communitySentimentBreakdownSchema,
  tldr: z.string(),
  post_count: z.number(),
  sources: z.array(z.string()).nullish(),
  pros: z.array(z.string()).nullish(),
  cons: z.array(z.string()).nullish(),
  by_source: z.array(communitySentimentSourceSchema).nullish(),
  hottest_debate: z.string().nullish(),
  open_questions: z.array(z.string()).nullish(),
  highlights: z.array(communitySentimentHighlightSchema).nullish(),
});

export const communitySentimentDiscussionSchema = z.object({
  provider: z.string().nullish(),
  url: z.string().nullish(),
  points: z.number().nullish(),
  comments_count: z.number().nullish(),
});

export const communitySentimentDiscussionsSchema = z.array(
  communitySentimentDiscussionSchema,
);

export type CommunitySentimentLean = z.infer<
  typeof communitySentimentLeanSchema
>;
export type CommunitySentimentPayload = z.infer<
  typeof communitySentimentPayloadSchema
>;
export type CommunitySentimentDiscussionPayload = z.infer<
  typeof communitySentimentDiscussionSchema
>;
