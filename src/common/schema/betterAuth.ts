import { z } from 'zod';

const betterAuthSocialProviders = [
  'google',
  'github',
  'apple',
  'facebook',
] as const;

export const betterAuthCallbackParamsSchema = z.object({
  provider: z.enum(betterAuthSocialProviders),
});
