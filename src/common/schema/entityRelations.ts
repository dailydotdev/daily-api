import { z } from 'zod';

const rankingLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(10)
  .optional()
  .default(10);

export const topCreatorsByTagSchema = z.object({
  tag: z.string().min(1),
  limit: rankingLimitSchema,
});

export const similarCreatorsSchema = z.object({
  userId: z.string().min(1),
  limit: rankingLimitSchema,
});

export const topMembersBySquadSchema = z.object({
  sourceId: z.string().min(1),
  since: z.coerce.date(),
  limit: rankingLimitSchema,
});
