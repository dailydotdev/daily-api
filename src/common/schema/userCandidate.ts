import {
  CandidateStatus,
  EmploymentType,
  LocationType,
  SalaryPeriod,
} from '@dailydotdev/schema';
import z from 'zod';
import { acceptedEmploymentAgreementFiles, createFileSchema } from './files';

export enum RoleType {
  IC = 0.0,
  Auto = 0.5,
  Managerial = 1.0,
}

export const gcsBlobSchema = z.object({
  blob: z.string().optional(),
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  bucket: z.string().optional(),
  lastModified: z.date().optional(),
});

export type UserCandidateCV = z.infer<typeof gcsBlobSchema>;
export type GCSBlob = z.infer<typeof gcsBlobSchema>;

export const salaryExpectationSchema = z.object({
  min: z.coerce
    .bigint()
    .min(BigInt(0))
    .transform((val) => val.toString())
    .optional()
    .nullable(),
  period: z
    .enum(SalaryPeriod, { error: 'Invalid salary period' })
    .refine((val) => val !== SalaryPeriod.UNSPECIFIED, {
      message: 'Invalid salary period',
    })
    .optional()
    .nullable(),
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

export const userCandidateToggleKeywordSchema = z.object({
  keywords: z
    .array(z.string().trim().min(1, 'Keyword cannot be empty'))
    .min(1, 'At least one keyword is required')
    .max(100, 'Too many keywords provided'),
});

export const uploadEmploymentAgreementSchema = z.object({
  file: z.promise(createFileSchema(acceptedEmploymentAgreementFiles)),
});
