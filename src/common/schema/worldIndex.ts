import { z } from 'zod';
import { enumValues } from './utils';
import { UserNicheRankPeriod } from '../../entity/user/UserNicheRank';
import { NicheDomain } from '../../entity/Niche';

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

export const worldDomainRankingSchema = z.object({
  domain: z.enum(enumValues(NicheDomain)),
  period: z.enum(enumValues(UserNicheRankPeriod)),
  limit: z.number().int().nullish(),
});

export const worldDomainRankPositionSchema = z.object({
  domain: z.enum(enumValues(NicheDomain)),
  period: z.enum(enumValues(UserNicheRankPeriod)),
});

export const followedWorldsSchema = z.object({
  first: z.number().int().nullish(),
  after: z.string().nullish(),
});
