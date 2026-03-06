import { z } from 'zod';

const linearWebhookActions = ['create', 'update', 'remove'] as const;

export const linearWebhookActionSchema = z.literal(linearWebhookActions);

export const linearIssueStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
});

export const linearIssueSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  state: linearIssueStateSchema.optional(),
});

export const linearIssueReferenceSchema = z.object({
  id: z.string(),
});

export const linearCommentUserSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
});

export const linearCommentDataSchema = z.object({
  id: z.string(),
  body: z.string(),
  issueId: z.string().nullish(),
  issue: linearIssueReferenceSchema.nullish(),
  user: linearCommentUserSchema.optional(),
  parentId: z.string().nullish(),
});

export const linearIssueWebhookPayloadSchema = z.object({
  action: z.enum(linearWebhookActions),
  type: z.literal('Issue'),
  data: linearIssueSchema,
  updatedFrom: z
    .object({
      stateId: z.string().optional(),
    })
    .optional(),
});

export const linearCommentWebhookPayloadSchema = z.object({
  action: z.literal('create'),
  type: z.literal('Comment'),
  data: linearCommentDataSchema,
});

export const linearWebhookPayloadSchema = z.discriminatedUnion('type', [
  linearIssueWebhookPayloadSchema,
  linearCommentWebhookPayloadSchema,
]);

export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>;
export type LinearIssueState = z.infer<typeof linearIssueStateSchema>;
