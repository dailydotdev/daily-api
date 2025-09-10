import {
  CandidateStatus,
  EmploymentType,
  LocationType,
  SalaryPeriod,
} from '@dailydotdev/schema';
import z from 'zod';
import { snapToHalf } from '../utils';

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

export const candidatePreferenceSchema = z.object({
  status: z
    .enum(CandidateStatus, { error: 'Invalid candidate status' })
    .optional(),
  role: z.string().min(3).max(100).optional(),
  roleType: z.number().transform(snapToHalf).pipe(z.enum(RoleType)).optional(),
  employmentType: z
    .array(z.enum(EmploymentType, { error: 'Invalid employment type' }))
    .optional(),
  salaryExpectation: z
    .object({
      min: z.number().min(0).optional(),
      period: z
        .enum(SalaryPeriod, { error: 'Invalid salary period' })
        .optional(),
    })
    .optional(),
  location: z
    .array(
      z.object({
        city: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
  locationType: z
    .array(z.enum(LocationType, { error: 'Invalid location type' }))
    .optional(),
});
