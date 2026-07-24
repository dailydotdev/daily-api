import z from 'zod';
import { enumValues } from './utils';
import {
  UserInterestCadence,
  UserInterestStatus,
} from '../../entity/UserInterest';

export const createInterestSchema = z.object({
  query: z.string().min(1).max(500),
});

export const updateInterestSchema = z.object({
  status: z.enum(enumValues(UserInterestStatus)).optional(),
  cadence: z.enum(enumValues(UserInterestCadence)).optional(),
  fomoThreshold: z.number().min(0).max(1).optional(),
  sources: z
    .object({
      dailyDev: z.boolean(),
      web: z.boolean(),
      github: z.boolean(),
    })
    .partial()
    .optional(),
  outputModes: z
    .object({
      feed: z.boolean(),
      post: z.boolean(),
      digest: z.boolean(),
      notification: z.boolean(),
    })
    .partial()
    .optional(),
});

export const interestIdSchema = z.object({
  id: z.string().min(1),
});

export const sendInterestCommandSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
});
