import z from 'zod';

export const opportunityMatchDescriptionSchema = z.object({
  reasoning: z.string(),
  reasoningShort: z.string(),
  matchScore: z.number(),
});
