import { z } from 'zod';

export const slackActionValueSchema = z.object({
  opportunityId: z.string(),
  userId: z.string(),
});

export const slackInteractionPayloadSchema = z.object({
  type: z.literal('block_actions'),
  actions: z
    .array(
      z.object({
        action_id: z.enum([
          'candidate_review_accept',
          'candidate_review_reject',
        ]),
        value: z.string(),
      }),
    )
    .min(1),
  response_url: z.string().url().optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
    })
    .optional(),
});
