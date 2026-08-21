import z from 'zod';
import { enumValues } from './utils';
import {
  UserInterestCadence,
  UserInterestStatus,
} from '../../entity/UserInterest';

const interestSourcesSchema = z
  .object({
    dailyDev: z.boolean(),
    web: z.boolean(),
    github: z.boolean(),
  })
  .partial()
  .optional();

const interestOutputModesSchema = z
  .object({
    feed: z.boolean(),
    post: z.boolean(),
    digest: z.boolean(),
    notification: z.boolean(),
  })
  .partial()
  .optional();

export const updateInterestSchema = z.object({
  status: z.enum(enumValues(UserInterestStatus)).optional(),
  cadence: z.enum(enumValues(UserInterestCadence)).optional(),
  fomoThreshold: z.number().min(0).max(1).optional(),
  sources: interestSourcesSchema,
  outputModes: interestOutputModesSchema,
});

export const createInterestSchema = z.object({
  query: z.string().min(1).max(500),
  settings: updateInterestSchema.omit({ status: true }).optional(),
});

export const interestIdSchema = z.object({
  id: z.string().min(1),
});

export const interestHistorySchema = z.object({
  id: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
  before: z.string().min(1).max(200).optional(),
});

export const sendInterestCommandSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
  triggerRun: z.boolean().optional(),
});
