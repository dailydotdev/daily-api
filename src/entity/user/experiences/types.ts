import { z } from 'zod';

export enum UserExperienceType {
  Work = 'work',
  Education = 'education',
  Project = 'project',
  Certification = 'certification',
  Award = 'award',
  Publication = 'publication',
  Course = 'course',
}

export enum ExperienceStatus {
  Draft = 'draft',
  Published = 'published',
}

export enum WorkEmploymentType {
  FullTime = 'full_time',
  PartTime = 'part_time',
  SelfEmployed = 'self_employed',
  Freelance = 'freelance',
  Contract = 'contract',
  Internship = 'internship',
  Apprenticeship = 'apprenticeship',
  Seasonal = 'seasonal',
}

export enum WorkVerificationStatus {
  Pending = 'pending',
  Verified = 'verified',
  Failed = 'failed',
}

export enum ProjectLinkType {
  Code = 'code',
  LivePreview = 'livePreview',
  Demo = 'demo',
  InteractiveDemo = 'interactiveDemo',
}

export type ProjectLink = {
  type: ProjectLinkType;
  url: string;
};

// Zod schema for ProjectLink
export const projectLinkSchema = z.object({
  type: z.nativeEnum(ProjectLinkType),
  url: z.string().url('URL must be a valid URL'),
});

// Base Zod schema for UserExperience
export const baseUserExperienceSchema = z.object({
  id: z.string().uuid().optional(), // Optional for creation
  userId: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().default(''),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  status: z.nativeEnum(ExperienceStatus).default(ExperienceStatus.Draft),
  flags: z.record(z.string(), z.unknown()).default({}),
});
