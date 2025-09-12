import z from 'zod';

export const opportunityMatchDescriptionSchema = z.object({
  reasoning: z.string(),
  matchScore: z.number(),
});
