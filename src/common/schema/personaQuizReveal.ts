import { z } from 'zod';
import { personaQuizQAPairSchema } from './personaQuizNextQuestion';

const MAX_TAG = 80;

export const personaQuizRevealInputSchema = z.object({
  answers: z.array(personaQuizQAPairSchema).min(1).max(20),
  seedTags: z.array(z.string().min(1).max(MAX_TAG)).max(32).default([]),
  targetCount: z.number().int().min(1).max(20).default(8),
});

export type PersonaQuizRevealInput = z.infer<
  typeof personaQuizRevealInputSchema
>;
