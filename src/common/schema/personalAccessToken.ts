import z from 'zod';

export const createPersonalAccessTokenSchema = z.object({
  name: z.string().min(1).max(50),
  expiresInDays: z.number().int().positive().nullish(),
});

export type CreatePersonalAccessTokenInput = z.infer<
  typeof createPersonalAccessTokenSchema
>;
