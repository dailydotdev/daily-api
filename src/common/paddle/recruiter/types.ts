import z from 'zod';

export const recruiterPaddleCustomDataSchema = z.object({
  user_id: z.string(),
  opportunity_id: z.uuid(),
});

export const recruiterPaddlePricingCustomDataSchema = z.object({
  batch_size: z.coerce.number().nonnegative().max(10_000),
  reminders: z.boolean().nullish(),
  show_slack: z.boolean().nullish(),
});
