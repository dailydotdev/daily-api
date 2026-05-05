import { z } from 'zod';

export const onboardingProfileTagsInputSchema = z.object({
  prompt: z.string().min(1).max(2000),
});
