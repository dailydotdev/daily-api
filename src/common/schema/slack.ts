import { z } from 'zod';

export const slackOpportunityActionValueSchema = z.object({
  opportunityId: z.string(),
  userId: z.string(),
});

export const slackOpportunityReviewValueSchema = z.object({
  opportunityId: z.string(),
});

// Unified schema for all Slack interaction payloads
export const slackInteractionPayloadSchema = z.object({
  type: z.literal('block_actions'),
  actions: z
    .array(
      z.object({
        action_id: z.string(),
        value: z.string(),
      }),
    )
    .min(1),
  response_url: z.url().optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
    })
    .optional(),
});

export type SlackInteractionPayload = z.infer<
  typeof slackInteractionPayloadSchema
>;
export type SlackAction = SlackInteractionPayload['actions'][number];

// Deprecated: Use slackInteractionPayloadSchema instead
export const slackOpportunityCandidateReviewPayloadSchema = z.object({
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
  response_url: z.url().optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
    })
    .optional(),
});

// Deprecated: Use slackInteractionPayloadSchema instead
export const slackOpportunityReviewPayloadSchema = z.object({
  type: z.literal('block_actions'),
  actions: z
    .array(
      z.object({
        action_id: z.enum([
          'opportunity_review_accept',
          'opportunity_review_reject',
        ]),
        value: z.string(),
      }),
    )
    .min(1),
  response_url: z.url().optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
    })
    .optional(),
});
