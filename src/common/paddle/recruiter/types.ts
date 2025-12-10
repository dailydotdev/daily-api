import z from 'zod';

export const recruiterPaddleCustomDataSchema = z.object({
  user_id: z.string(),
  opportunity_id: z.uuid(),
});
