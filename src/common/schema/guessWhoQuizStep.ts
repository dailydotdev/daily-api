import { z } from 'zod';

const MAX_TEXT = 500;

export const guessWhoQuizStepInputSchema = z.object({
  history: z
    .array(
      z.object({
        question: z.string().min(1).max(MAX_TEXT),
        answer: z.string().min(1).max(MAX_TEXT),
      }),
    )
    .min(5)
    .max(20),
});
