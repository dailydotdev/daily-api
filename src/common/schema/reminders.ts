import z from 'zod';

export const entityReminderSchema = z.object({
  entityId: z.string(),
  entityTableName: z.string(),
  scheduledAtMs: z.number().int().nonnegative(),
  delayMs: z.number().int().nonnegative(),
});
