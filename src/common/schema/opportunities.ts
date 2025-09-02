import z from 'zod';
import { locationSchema, locationTypeSchema } from './userCandidate';

export const opportunityContentSchema = z.object({
  title: z.string(),
  content: z.string(),
  html: z.string().optional(),
});

export const opportunityMetaSchema = z.object({
  location: locationSchema,
  location_type: locationTypeSchema,
  employmentType: z.string(),
  teamSize: z.string(),
  salaryRange: z.string(),
  seniorityLevel: z.string(),
  roleType: z.string(),
});

export const opportunityMatchDescriptionSchema = z.object({
  description: z.string(),
  rank: z.number(),
});

export const opportunityMatchScreeningSchema = z.object({
  screening: z.string(),
  answer: z.string(),
});
