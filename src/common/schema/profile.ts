import z from 'zod';
import { UserExperienceType } from '../../entity/user/experiences/types';
import { paginationSchema } from './common';

export const userExperiencesSchema = z
  .object({
    userId: z.string().nonempty(),
    type: z.enum(UserExperienceType).optional(),
  })
  .extend(paginationSchema.shape);

export const userExperienceInputBaseSchema = z.object({
  type: z.enum(UserExperienceType),
  title: z.string().max(1000).nonempty(),
  description: z.string().max(5000).optional(),
  subtitle: z.string().max(1000).optional(),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  companyId: z.string().nullable().optional().default(null),
  customCompanyName: z
    .string()
    .trim()
    .normalize()
    .max(100)
    .nonempty()
    .nullable()
    .optional()
    .default(null),
});

export const userExperienceCertificationSchema = z
  .object({
    url: z.url().optional(),
    externalReferenceId: z.string().optional(),
  })
  .extend(userExperienceInputBaseSchema.shape);

export const userExperienceEducationSchema = z
  .object({ grade: z.string().optional() })
  .extend(userExperienceInputBaseSchema.shape);

export const userExperienceProjectSchema = z
  .object({ url: z.url().optional() })
  .extend(userExperienceInputBaseSchema.shape);

export const userExperienceWorkSchema = z
  .object({
    externalReferenceId: z.string().optional(),
    employmentType: z.number().nullable().optional().default(null),
    locationType: z.number().nullable().optional().default(null),
    locationId: z.uuidv4().nullable().optional().default(null),
    skills: z
      .array(z.string().lowercase().max(100))
      .optional()
      .default([])
      .refine(
        (arr) => {
          const uniqueSkills = new Set(arr);
          return uniqueSkills.size === arr.length;
        },
        { message: 'Skills must be unique from each other' },
      ),
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
  });
};
