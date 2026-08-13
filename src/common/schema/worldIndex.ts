import { z } from 'zod';
import { enumValues } from './utils';
import { UserNicheRankPeriod } from '../../entity/user/UserNicheRank';

export const worldTopicRankingSchema = z.object({
  nicheId: z.uuid(),
  period: z.enum(enumValues(UserNicheRankPeriod)),
  limit: z.number().int().nullish(),
});

export const worldTopicRankPositionSchema = z.object({
  nicheId: z.uuid(),
  period: z.enum(enumValues(UserNicheRankPeriod)),
});

export const worldTopicReadersSchema = z.object({
  nicheIds: z.array(z.uuid()).nullish(),
});

export const worldIndexSectionSchema = z.object({
  limit: z.number().int().nullish(),
});
