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

// Linear webhook payload schema for Issue events
export const linearWebhookPayloadSchema = z.object({
  action: z.enum(linearWebhookActions),
  type: z.string(),
  data: linearIssueSchema,
  updatedFrom: z
    .object({
      stateId: z.string().optional(),
    })
    .optional(),
});

export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>;
export type LinearIssueState = z.infer<typeof linearIssueStateSchema>;
