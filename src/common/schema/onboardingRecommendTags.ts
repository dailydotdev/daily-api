import { z } from 'zod';

const MAX_TAGS = 100;
const MAX_N = 100;

export const onboardingRecommendTagsInputSchema = z.object({
  selectedTags: z.array(z.string().min(1)).min(1).max(MAX_TAGS),
  n: z.number().int().min(1).max(MAX_N).optional(),
});
