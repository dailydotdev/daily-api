import { z } from 'zod';

const MAX_TEXT = 500;
const MAX_TAG = 80;

export const personaQuizQAPairSchema = z.object({
  questionId: z.string().min(1).max(MAX_TAG),
  question: z.string().min(1).max(MAX_TEXT),
  optionId: z.string().min(1).max(MAX_TAG),
  answer: z.string().min(1).max(MAX_TEXT),
});

export const personaQuizNextQuestionInputSchema = z.object({
  priorAnswers: z.array(personaQuizQAPairSchema).min(1).max(20),
  seedTags: z.array(z.string().min(1).max(MAX_TAG)).max(32).default([]),
  askedCount: z.number().int().min(1).max(20),
  maxQuestions: z.number().int().min(1).max(20).default(14),
});

export type PersonaQuizNextQuestionInput = z.infer<
  typeof personaQuizNextQuestionInputSchema
>;
