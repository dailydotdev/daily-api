import z from 'zod';

export const opportunityScreeningAnswersSchema = z.object({
  id: z.uuid(),
  answers: z.array(
    z.object({
      questionId: z.uuid(),
      answer: z.string().max(500),
    }),
  ),
});
