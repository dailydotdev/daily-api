import z from 'zod';

export const OpportunityContentSchema = z.object({
  title: z.string(),
  content: z.string(),
  html: z.string().optional(),
});

export const OpportunityMetaSchema = z.object({
  location: z.string(),
  workSite: z.string(),
  employmentType: z.string(),
  teamSize: z.string(),
  salaryRange: z.string(),
  seniorityLevel: z.string(),
  roleType: z.string(),
});

export const OpportunityMatchDescriptionSchema = z.object({
  description: z.string(),
  rank: z.number(),
});

export const OpportunityMatchScreeningSchema = z.object({
  screening: z.string(),
  answer: z.string(),
});
