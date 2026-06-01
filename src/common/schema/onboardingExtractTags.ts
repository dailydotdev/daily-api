import { z } from 'zod';

const MAX_PROMPT = 2000;

export const onboardingExtractTagsInputSchema = z.object({
  prompt: z.string().min(1).max(MAX_PROMPT),
});
