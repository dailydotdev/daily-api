import z from 'zod';

export const CAMPAIGN_VALIDATION_SCHEMA = z.object({
  budget: z
    .int()
    .min(1000)
    .max(100000)
    .refine((value) => value % 1000 === 0, {
      error: 'Budget must be divisible by 1000',
    }),
  duration: z.int().min(1).max(30),
});
