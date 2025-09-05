import z from 'zod';

export const opportunityMatchDescriptionSchema = z.object({
  description: z.string(),
  rank: z.number(),
});

export const opportunityMatchScreeningSchema = z.object({
  screening: z.string(),
  answer: z.string(),
});
