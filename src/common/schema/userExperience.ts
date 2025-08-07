import { z } from 'zod';
import {
  ExperienceStatus,
  ProjectLinkType,
  UserExperienceType,
  WorkEmploymentType,
  WorkVerificationStatus,
} from '../../entity/user/experiences/types';
import { WorkLocationType } from '../../entity/user/UserJobPreferences';

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

// Zod schema for ProjectLink
export const projectLinkSchema = z.object({
  type: z.nativeEnum(ProjectLinkType),
  url: z.string().url('URL must be a valid URL'),
});

// Zod schema for UserAwardExperience
export const userAwardExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Award),
  issuer: z.string().nullable().optional(),
  workingExperienceId: z.string().uuid().nullable().optional(),
  educationExperienceId: z.string().uuid().nullable().optional(),
});

// Zod schema for UserCertificationExperience
export const userCertificationExperienceSchema =
  baseUserExperienceSchema.extend({
    type: z.literal(UserExperienceType.Certification),
    courseNumber: z.string().nullable().optional(),
    companyId: z.string().uuid(),
    credentialId: z.string().nullable().optional(),
    credentialUrl: z
      .string()
      .url('Credential URL must be a valid URL')
      .nullable()
      .optional(),
  });

// Zod schema for UserCourseExperience
export const userCourseExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Course),
  courseNumber: z.string().nullable().optional(),
  institution: z.string().nullable().optional(),
});

// Zod schema for UserEducationExperience
export const userEducationExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Education),
  schoolId: z.string().uuid(),
  fieldOfStudy: z.string().min(1, 'Field of study is required'),
  grade: z.string().nullable().optional(),
  extracurriculars: z.string().nullable().optional(),
});

// Zod schema for UserProjectExperience
export const userProjectExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Project),
  links: z.array(projectLinkSchema).default([]),
  contributors: z.array(z.string()).default([]),
  workingExperienceId: z.string().uuid().nullable().optional(),
  educationExperienceId: z.string().uuid().nullable().optional(),
});

// Zod schema for UserPublicationExperience
export const userPublicationExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Publication),
  publisher: z.string().nullable().optional(),
  url: z.string().url('URL must be a valid URL').nullable().optional(),
  contributors: z.array(z.string()).default([]),
  workingExperienceId: z.string().uuid().nullable().optional(),
  educationExperienceId: z.string().uuid().nullable().optional(),
});

// Zod schema for UserWorkExperience
export const userWorkExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Work),
  companyId: z.string().uuid(),
  employmentType: z.nativeEnum(WorkEmploymentType),
  location: z.string().nullable().optional(),
  locationType: z.nativeEnum(WorkLocationType).nullable().optional(),
  achievements: z.array(z.string()).default([]),
  verificationEmail: z.string().email().nullable().optional(),
  verificationStatus: z
    .nativeEnum(WorkVerificationStatus)
    .nullable()
    .optional(),
});
