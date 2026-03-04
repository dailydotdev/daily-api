import { z } from 'zod';

// Linear webhook action types
const linearWebhookActions = ['create', 'update', 'remove'] as const;

export const linearWebhookActionSchema = z.literal(linearWebhookActions);

// Linear issue state schema
export const linearIssueStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
});

// Linear issue schema for the webhook payload
export const linearIssueSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  state: linearIssueStateSchema.optional(),
});

export const linearCommentDataSchema = z.object({
  id: z.string(),
  body: z.string(),
  issue: z.object({
    id: z.string(),
  }),
  user: z
    .object({
      name: z.string(),
      email: z.email().optional(),
    })
    .optional(),
});

const linearIssueWebhookPayloadSchema = z.object({
  action: z.enum(linearWebhookActions),
  type: z.literal('Issue'),
  data: linearIssueSchema,
  updatedFrom: z
    .object({
      stateId: z.string().optional(),
    })
    .optional(),
});

const linearCommentWebhookPayloadSchema = z.object({
  action: z.literal('create'),
  type: z.literal('Comment'),
  data: linearCommentDataSchema,
});

// Linear webhook payload schema for feedback issue status/replies
export const linearWebhookPayloadSchema = z.discriminatedUnion('type', [
  linearIssueWebhookPayloadSchema,
  linearCommentWebhookPayloadSchema,
]);

export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>;
export type LinearIssueState = z.infer<typeof linearIssueStateSchema>;
