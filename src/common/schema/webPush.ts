import z from 'zod';

const normalizeOrigin = (origin: string): string => {
  const normalized = origin.includes('://') ? origin : `https://${origin}`;
  return new URL(normalized).origin;
};

export const syncWebPushSubscriptionSchema = z.object({
  subscriptionId: z.uuid().optional(),
  origin: z
    .string()
    .min(1)
    .transform((origin, ctx) => {
      try {
        return normalizeOrigin(origin);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid origin',
        });
        return z.NEVER;
      }
    })
    .optional(),
  optedIn: z.boolean().default(true),
});

export type SyncWebPushSubscriptionInput = z.infer<
  typeof syncWebPushSubscriptionSchema
>;
