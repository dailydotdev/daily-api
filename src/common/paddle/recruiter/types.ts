import z from 'zod';
import { zCoerceStringBoolean } from '../../schema/common';

export const recruiterPaddleCustomDataSchema = z.object({
  user_id: z.string(),
  opportunity_id: z.uuid(),
});

export const recruiterPaddlePricingCustomDataSchema = z.object({
  batch_size: z.coerce.number().nonnegative().max(10_000),
  reminders: zCoerceStringBoolean.nullish(),
  show_slack: zCoerceStringBoolean.nullish(),
});
