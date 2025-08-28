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
  max: z.number().min(0).nullable(),
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
  city: z.string().nullable(),
  country: z.string().nullable(),
  subdivision: z.string().nullable(),
  continent: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});
