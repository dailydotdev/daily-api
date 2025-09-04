import z from 'zod';

export enum SalaryDuration {
  Monthly = 'monthly',
  Annualy = 'annualy',
}

export const userCandidateCVSchema = z.object({
  bucket: z.string(),
  blob: z.string(),
  lastModified: z.date(),
});

export const salaryExpectationSchema = z.object({
  min: z.number().min(0).nullable(),
  currency: z.string().default('USD'),
  period: z.enum(SalaryDuration, {
    error: 'Invalid salary duration',
  }),
});

export const locationTypeSchema = z.object({
  remote: z.boolean(),
  office: z.boolean(),
  onSite: z.boolean(),
});

export const locationSchema = z.object({
  city: z.string().optional(),
  country: z.string().optional(),
  subdivision: z.string().optional(),
  continent: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
