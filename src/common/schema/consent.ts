import { z } from 'zod';

export const tcfConsentHeaderSchema = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^[A-Za-z0-9\-_.~]+$/);
