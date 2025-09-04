import z from 'zod';
import { OpportunityState } from '@dailydotdev/schema';
import { OpportunityType } from '../../entity/opportunities/types';
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

export const opportunitySchema = z.object({
  id: z.uuid(),
  createdAt: z.string().transform((str) => new Date(str)),
  updatedAt: z.string().transform((str) => new Date(str)),
  type: z.enum(OpportunityType, {
    error: 'Invalid opportunity type',
  }),
  state: z.enum(OpportunityState, {
    error: 'Invalid opportunity state',
  }),
  title: z.string(),
  tldr: z.string(),
  content: z.array(opportunityContentSchema),
  meta: opportunityMetaSchema,
  keywords: z.array(z.string()).optional(),
});
