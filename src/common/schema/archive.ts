import { z } from 'zod';
import {
  ArchivePeriodType,
  ArchiveRankingType,
  ArchiveScopeType,
  ArchiveSubjectType,
} from '../archive';
import { enumValues } from './utils';

const archiveSubjectTypeSchema = z.enum(enumValues(ArchiveSubjectType));
const archiveRankingTypeSchema = z.enum(enumValues(ArchiveRankingType));
const archiveScopeTypeSchema = z.enum(enumValues(ArchiveScopeType));
const archivePeriodTypeSchema = z.enum(enumValues(ArchivePeriodType));

export const archiveQuerySchema = z
  .object({
    subjectType: archiveSubjectTypeSchema,
    rankingType: archiveRankingTypeSchema,
    scopeType: archiveScopeTypeSchema,
    scopeId: z.string().min(1).nullish(),
    periodType: archivePeriodTypeSchema,
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.scopeType !== ArchiveScopeType.Global && !value.scopeId) {
      ctx.addIssue({
        code: 'custom',
        message: 'scopeId is required for non-global scopes',
        path: ['scopeId'],
      });
    }

    if (value.scopeType === ArchiveScopeType.Global && value.scopeId) {
      ctx.addIssue({
        code: 'custom',
        message: 'scopeId must not be set for global scopes',
        path: ['scopeId'],
      });
    }

    if (value.periodType === ArchivePeriodType.Month && !value.month) {
      ctx.addIssue({
        code: 'custom',
        message: 'month is required for monthly archives',
        path: ['month'],
      });
    }

    if (value.periodType === ArchivePeriodType.Year && value.month) {
      ctx.addIssue({
        code: 'custom',
        message: 'month must not be set for yearly archives',
        path: ['month'],
      });
    }
  });

export const archiveIndexQuerySchema = z
  .object({
    subjectType: archiveSubjectTypeSchema,
    rankingType: archiveRankingTypeSchema,
    scopeType: archiveScopeTypeSchema,
    scopeId: z.string().min(1).nullish(),
    periodType: archivePeriodTypeSchema.nullish(),
    year: z.number().int().min(2000).max(2100).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.scopeType === ArchiveScopeType.Global && value.scopeId) {
      ctx.addIssue({
        code: 'custom',
        message: 'scopeId must not be set for global scopes',
        path: ['scopeId'],
      });
    }
  });
