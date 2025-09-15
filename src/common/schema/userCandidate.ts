import {
  CandidateStatus,
  EmploymentType,
  LocationType,
  SalaryPeriod,
} from '@dailydotdev/schema';
import z from 'zod';

export enum RoleType {
  IC = 0.0,
  Auto = 0.5,
  Managerial = 1.0,
}

export const userCandidateCVSchema = z.object({
  blob: z.string().optional(),
  contentType: z.string().optional(),
  bucket: z.string().optional(),
  lastModified: z.date().optional(),
});

export type UserCandidateCV = z.infer<typeof userCandidateCVSchema>;

export const salaryExpectationSchema = z.object({
  min: z.coerce
    .bigint()
    .min(BigInt(0))
    .transform((val) => val.toString())
    .optional(),
  period: z
    .enum(SalaryPeriod, { error: 'Invalid salary period' })
    .refine((val) => val !== SalaryPeriod.UNSPECIFIED, {
      message: 'Invalid salary period',
    })
    .optional(),
});

export const candidatePreferenceSchema = z.object({
  status: z
    .enum(CandidateStatus, { error: 'Invalid candidate status' })
    .refine((val) => val !== CandidateStatus.UNSPECIFIED, {
      message: 'Invalid candidate status',
    })
    .optional(),
  role: z.string().max(100).optional(),
  roleType: z.enum(RoleType, { error: 'Invalid role type' }).optional(),
  employmentType: z
    .array(
      z
        .enum(EmploymentType, { error: 'Invalid employment type' })
        .refine((val) => val !== EmploymentType.UNSPECIFIED, {
          message: 'Invalid employment type',
        }),
    )
    .optional(),
  salaryExpectation: salaryExpectationSchema.optional(),
  location: z
    .array(
      z.object({
        city: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
  locationType: z
    .array(
      z
        .enum(LocationType, { error: 'Invalid location type' })
        .refine((val) => val !== LocationType.UNSPECIFIED, {
          message: 'Invalid location type',
        }),
    )
    .optional(),
  customKeywords: z.boolean().optional(),
});
