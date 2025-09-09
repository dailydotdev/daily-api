import z from 'zod';

export const opportunityMatchDescriptionSchema = z.object({
  reasoning: z.string(),
  matchScore: z.number(),
});

export const opportunityMatchScreeningSchema = z.object({
  screening: z.string(),
  answer: z.string(),
});
