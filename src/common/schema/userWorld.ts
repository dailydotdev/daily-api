import { z } from 'zod';

export const userWorldDeltaSchema = z.strictObject({
  userId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nicheId: z.string().uuid(),
  reads: z.coerce.number().int().positive(),
});

export type UserWorldDelta = z.infer<typeof userWorldDeltaSchema>;
