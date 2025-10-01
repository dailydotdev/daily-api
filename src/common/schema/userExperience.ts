import { z } from 'zod';
import {
  ExperienceStatus,
  ProjectLinkType,
  UserExperienceType,
  WorkEmploymentType,
  WorkLocationType,
  WorkVerificationStatus,
} from '../../entity/user/experiences/types';

export const baseUserExperienceSchema = z.object({
  id: z.uuid().optional(), // Optional for creation
  userId: z.uuid(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().prefault(''),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  status: z.enum(ExperienceStatus).prefault(ExperienceStatus.Draft),
  flags: z.record(z.string(), z.unknown()).prefault({}),
});

// Zod schema for ProjectLink
export const projectLinkSchema = z.object({
  type: z.enum(ProjectLinkType),
  url: z.url('URL must be a valid URL'),
});

// Zod schema for UserAwardExperience
export const userAwardExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Award),
  issuer: z.string().nullable().optional(),
  workingExperienceId: z.uuid().nullable().optional(),
  educationExperienceId: z.uuid().nullable().optional(),
});

// Zod schema for UserCertificationExperience
export const userCertificationExperienceSchema =
  baseUserExperienceSchema.extend({
    type: z.literal(UserExperienceType.Certification),
    courseNumber: z.string().nullable().optional(),
    companyId: z.uuid(),
    credentialId: z.string().nullable().optional(),
    credentialUrl: z
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
  schoolId: z.uuid(),
  fieldOfStudy: z.string().min(1, 'Field of study is required'),
  grade: z.string().nullable().optional(),
  extracurriculars: z.string().nullable().optional(),
});

// Zod schema for UserProjectExperience
export const userProjectExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Project),
  links: z.array(projectLinkSchema).prefault([]),
  contributors: z.array(z.string()).prefault([]),
  workingExperienceId: z.uuid().nullable().optional(),
  educationExperienceId: z.uuid().nullable().optional(),
});

// Zod schema for UserPublicationExperience
export const userPublicationExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Publication),
  publisher: z.string().nullable().optional(),
  url: z.url('URL must be a valid URL').nullable().optional(),
  contributors: z.array(z.string()).prefault([]),
  workingExperienceId: z.uuid().nullable().optional(),
  educationExperienceId: z.uuid().nullable().optional(),
});

// Zod schema for UserWorkExperience
export const userWorkExperienceSchema = baseUserExperienceSchema.extend({
  type: z.literal(UserExperienceType.Work),
  companyId: z.uuid(),
  employmentType: z.enum(WorkEmploymentType),
  location: z.string().nullable().optional(),
  locationType: z.enum(WorkLocationType).nullable().optional(),
  achievements: z.array(z.string()).prefault([]),
  verificationEmail: z.email().nullable().optional(),
  verificationStatus: z.enum(WorkVerificationStatus).nullable().optional(),
});
