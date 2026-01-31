import z from 'zod';
import { UserExperienceType } from '../../entity/user/experiences/types';
import { paginationSchema, urlParseSchema } from './common';
import { domainOnly } from '../links';

const domainSchema = z.preprocess(
  (val) => (val === '' ? null : val),
  urlParseSchema.transform(domainOnly).nullish(),
);

export const userExperiencesSchema = z
  .object({
    userId: z.string().nonempty(),
    type: z.enum(UserExperienceType).optional(),
  })
  .extend(paginationSchema.shape);

export const userExperienceInputBaseSchema = z.object({
  type: z.enum(UserExperienceType),
  title: z.string().max(1000).nonempty(),
  description: z.string().max(5000).nullish(),
  subtitle: z.string().max(1000).optional().nullable(),
  startedAt: z.date(),
  endedAt: z.date().optional().nullable().default(null),
  companyId: z.string().nullable().optional().default(null),
  customCompanyName: z
    .string()
    .trim()
    .normalize()
    .max(100)
    .nullish()
    .default(null),
});

export const userExperienceCertificationSchema = z
  .object({
    url: z.url().nullish(),
    externalReferenceId: z.string().nullish(),
  })
  .extend(userExperienceInputBaseSchema.shape);

export const userExperienceEducationSchema = z
  .object({
    grade: z.string().nullish(),
    customDomain: domainSchema,
  })
  .extend(userExperienceInputBaseSchema.shape);

export const userExperienceProjectSchema = z
  .object({ url: z.url().nullish() })
  .extend(userExperienceInputBaseSchema.shape);

export const repositoryInputSchema = z.object({
  id: z.string().min(1).nullish(),
  owner: z.string().max(100).nullish(),
  name: z.string().min(1).max(200),
  url: z.url(),
  image: z.url().nullish(),
});

export const userExperienceOpenSourceSchema = z
  .object({
    url: z.url().nullish(),
    repository: repositoryInputSchema.nullish(),
  })
  .extend(userExperienceInputBaseSchema.shape);

export const userExperienceWorkSchema = z
  .object({
    externalReferenceId: z.string().optional(),
    employmentType: z.number().nullish().default(null),
    locationType: z.number().nullish().default(null),
    externalLocationId: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().nullish().default(null),
    ),
    skills: z
      .array(z.string().trim().normalize().nonempty().max(100))
      .max(50)
      .optional()
      .default([]),
    customDomain: domainSchema,
  })
  .extend(userExperienceInputBaseSchema.shape);

const experienceTypeToSchema: Record<
  UserExperienceType,
  typeof userExperienceInputBaseSchema
> = {
  [UserExperienceType.Certification]: userExperienceCertificationSchema,
  [UserExperienceType.Education]: userExperienceEducationSchema,
  [UserExperienceType.Project]: userExperienceProjectSchema,
  [UserExperienceType.Work]: userExperienceWorkSchema,
  [UserExperienceType.Volunteering]: userExperienceProjectSchema,
  [UserExperienceType.OpenSource]: userExperienceOpenSourceSchema,
};

const experienceCompanyCopy = {
  [UserExperienceType.Work]: 'Company',
  [UserExperienceType.Education]: 'School',
  [UserExperienceType.Project]: 'Publisher',
  [UserExperienceType.Certification]: 'Organization',
  [UserExperienceType.OpenSource]: 'Organization',
  [UserExperienceType.Volunteering]: 'Organization',
};

export const getExperienceSchema = (type: UserExperienceType) => {
  return experienceTypeToSchema[type].superRefine((data, ctx) => {
    if (data.endedAt && data.endedAt < data.startedAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'endedAt must be greater than startedAt',
        path: ['endedAt'],
      });
    }

    // open source experiences do not have companies.
    const hasRepository =
      type === UserExperienceType.OpenSource &&
      'repository' in data &&
      data.repository;

    if (!data.customCompanyName && !data.companyId && !hasRepository) {
      ctx.addIssue({
        code: 'custom',
        message: `${experienceCompanyCopy[type]} is required`,
        path: ['customCompanyName'],
      });
    }
  });
};

export const userExperienceWorkImportSchema = z.object({
  type: z.string(),
  company: z.string().nullish(),
  title: z
    .string()
    .nullish()
    .transform((n) => (n === null ? undefined : n))
    .default('Work experience'),
  description: z.string().nullish(),
  started_at: z.coerce.date().default(() => new Date()),
  location_type: z.string().nullish(),
  skills: z
    .array(z.string())
    .nullish()
    .transform((n) => (n === null ? undefined : n))
    .default([]),
  ended_at: z.coerce.date().nullish().default(null),
  location: z
    .object({
      city: z.string().nullish(),
      country: z.string().nullish(),
    })
    .nullish(),
  flags: z.object({ import: z.string() }).partial().optional(),
  employment_type: z.string().nullish(),
});

export const userExperienceEducationImportSchema = z.object({
  type: z.string(),
  company: z.string().nullish(),
  title: z
    .string()
    .nullish()
    .transform((n) => (n === null ? undefined : n))
    .default('Education'),
  description: z.string().nullish(),
  started_at: z.coerce.date().default(() => new Date()),
  ended_at: z.coerce.date().nullish().default(null),
  location: z
    .object({
      city: z.string().nullish(),
      country: z.string().nullish(),
    })
    .nullish(),
  skills: z
    .array(z.string())
    .nullish()
    .transform((n) => (n === null ? undefined : n)),
  subtitle: z.string().nullish(),
  flags: z.object({ import: z.string() }).partial().optional(),
  grade: z.string().nullish(),
});

export const userExperienceCertificationImportSchema = z.object({
  type: z.string(),
  company: z.string().nullish(),
  title: z
    .string()
    .nullish()
    .transform((n) => (n === null ? undefined : n))
    .default('Certification'),
  started_at: z.coerce.date().default(() => new Date()),
  ended_at: z.coerce.date().nullish().default(null),
  flags: z.object({ import: z.string() }).partial().optional(),
  url: urlParseSchema.nullish().catch(undefined),
});

export const userExperienceProjectImportSchema = z.object({
  type: z.string(),
  title: z
    .string()
    .nullish()
    .transform((n) => (n === null ? undefined : n))
    .default('Project'),
  description: z.string().nullish(),
  started_at: z.coerce.date().default(() => new Date()),
  ended_at: z.coerce.date().nullish().default(null),
  skills: z
    .array(z.string())
    .nullish()
    .transform((n) => (n === null ? undefined : n)),
  flags: z.object({ import: z.string() }).partial().optional(),
  url: urlParseSchema.nullish().catch(undefined),
});
