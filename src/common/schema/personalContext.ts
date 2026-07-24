import { z } from 'zod';

const personalContextSourceRefSchema = z.object({
  kind: z.string(),
  value: z.string(),
});

export const generatePersonalContextSchema = z.object({
  userId: z.string(),
  correlationId: z.string().optional(),
  sources: z.array(personalContextSourceRefSchema),
});

const personalContextRankingSignalsSchema = z.object({
  boost_tags: z.array(z.string()).default([]),
  mute_tags: z.array(z.string()).default([]),
});

const personalContextContextSchema = z
  .object({
    headline: z.string().nullish(),
    summary: z.string().nullish(),
    seniority: z.string().nullish(),
    current_focus: z.string().nullish(),
    learning_goals: z.array(z.string()).nullish(),
    ranking_signals: personalContextRankingSignalsSchema.nullish(),
    profile_text: z.string().nullish(),
  })
  .catchall(z.unknown());

export const personalContextGeneratedSchema = z.object({
  userId: z.string(),
  correlationId: z.string().optional(),
  status: z.enum(['ok', 'error']),
  context: personalContextContextSchema.optional(),
  profileText: z.string().optional(),
  evidence: z.array(z.unknown()).optional(),
  errors: z.array(z.unknown()).optional(),
  error: z.string().optional(),
});
