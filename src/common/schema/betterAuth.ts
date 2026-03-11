import { z } from 'zod';

export const checkEmailQuerySchema = z.object({
  email: z.email(),
});

export const changeEmailBodySchema = z.object({
  newEmail: z.email().check(z.maxLength(254)),
});

export const verifyChangeEmailBodySchema = z.object({
  code: z.string().min(1),
});

export const setPasswordBodySchema = z.object({
  newPassword: z.string().min(8),
});

export const socialRedirectQuerySchema = z.object({
  provider: z.string().min(1),
  callbackURL: z.string().optional(),
});
