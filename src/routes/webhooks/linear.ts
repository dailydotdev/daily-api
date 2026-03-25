import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import createOrGetConnection from '../../db';
import { Feedback, FeedbackStatus } from '../../entity/Feedback';
import { FeedbackReply } from '../../entity/FeedbackReply';
import { User } from '../../entity/user/User';
import { logger } from '../../logger';
import { WebhookPayload } from '../../types';
import {
  linearWebhookPayloadSchema,
  type LinearWebhookPayload,
} from '../../common/schema/linearWebhook';
import { feedbackReplySchema } from '../../common/schema/feedback';
import {
  generateNotificationV2,
  storeNotificationBundleV2,
  type NotificationFeedbackCancelledContext,
  type NotificationFeedbackResolvedContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import {
  baseNotificationEmailData,
  CioTransactionalMessageTemplateId,
  sendEmail,
} from '../../common/mailing';

const linearStateToFeedbackStatus: Record<string, FeedbackStatus> = {
  'Needs Engineering Review': FeedbackStatus.Processing,
  Done: FeedbackStatus.Completed,
  Canceled: FeedbackStatus.Cancelled,
};

const feedbackStatusToNotificationType: Partial<
  Record<FeedbackStatus, NotificationType>
> = {
  [FeedbackStatus.Completed]: NotificationType.FeedbackResolved,
  [FeedbackStatus.Cancelled]: NotificationType.FeedbackCancelled,
};

const logLinearWebhookDebug = ({
  message,
  payload,
  extra,
}: {
  message: string;
  payload?: Pick<LinearWebhookPayload, 'action' | 'type'>;
  extra?: Record<string, unknown>;
}): void => {
  logger.debug(
    {
      action: payload?.action,
      type: payload?.type,
      ...extra,
    },
    message,
  );
};

const getLinearIssueId = ({
  payload,
}: {
  payload: LinearWebhookPayload;
}): string | null => {
  switch (payload.type) {
    case 'Issue':
      return payload.data.id;
    case 'Comment':
      return payload.data.issue?.id ?? payload.data.issueId ?? null;
  }
};

const verifyLinearSignature = (
  webhookSecret: string,
  req: FastifyRequest,
): boolean => {
  const signature = req.headers['linear-signature'] as string;

  if (!signature || !req.rawBody) {
    return false;
  }

  const hmac = createHmac('sha256', webhookSecret);
  hmac.update(req.rawBody);
  const expectedSignature = hmac.digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    return false;
  }
};

export const linear = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post<WebhookPayload<LinearWebhookPayload>>('/', {
    config: {
      rawBody: true,
    },
    handler: async (req, res) => {
      const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn('LINEAR_WEBHOOK_SECRET not configured');
        return res.status(503).send({ error: 'Webhook not configured' });
      }

      if (!verifyLinearSignature(webhookSecret, req)) {
        req.log.warn('linear webhook invalid signature');
        return res.status(403).send({ error: 'Invalid signature' });
      }

      const parseResult = linearWebhookPayloadSchema.safeParse(req.body);
      if (!parseResult.success) {
        logLinearWebhookDebug({
          message: 'linear webhook payload rejected',
          extra: {
            issues: parseResult.error.issues,
            action:
              typeof req.body === 'object' && req.body
                ? (req.body as { action?: unknown }).action
                : undefined,
            type:
              typeof req.body === 'object' && req.body
                ? (req.body as { type?: unknown }).type
                : undefined,
          },
        });
        return res.status(200).send({ success: true });
      }

      const payload = parseResult.data;
      const issueId = getLinearIssueId({ payload });

      if (payload.type === 'Comment') {
        const comment = payload.data;
        const commentBody = comment.body.trim();
        const replyPrefix = /^@reply\b/i;
        const isReplyCommand = replyPrefix.test(commentBody);

        if (!issueId) {
          logLinearWebhookDebug({
            message: 'linear comment webhook missing issue id',
            payload,
            extra: { commentId: comment.id },
          });
          return res.status(200).send({ success: true });
        }

        if (!isReplyCommand) {
          logLinearWebhookDebug({
            message: 'linear feedback comment ignored without @reply command',
            payload,
            extra: {
              commentId: comment.id,
              issueId,
              isReply: Boolean(comment.parentId),
            },
          });
          return res.status(200).send({ success: true });
        }

        const authorEmail = comment.user?.email?.trim();
        const safeAuthorEmail =
          authorEmail && z.email().safeParse(authorEmail).success
            ? authorEmail
            : null;

        const parsedReply = feedbackReplySchema.safeParse({
          body: commentBody.replace(replyPrefix, '').trim(),
          authorName: comment.user?.name ?? null,
          authorEmail: safeAuthorEmail,
        });

        if (!parsedReply.success) {
          logLinearWebhookDebug({
            message: 'linear feedback reply rejected by schema',
            payload,
            extra: {
              commentId: comment.id,
              issueId,
              issues: parsedReply.error.issues,
            },
          });
          return res.status(200).send({ success: true });
        }

        const con = await createOrGetConnection();
        const feedback = await con.getRepository(Feedback).findOne({
          where: { linearIssueId: issueId },
          select: {
            id: true,
            description: true,
            userId: true,
          },
        });

        if (!feedback) {
          logLinearWebhookDebug({
            message: 'linear feedback reply ignored non-feedback issue',
            payload,
            extra: {
              commentId: comment.id,
              issueId,
            },
          });
          return res.status(200).send({ success: true });
        }

        const reply = await con.getRepository(FeedbackReply).save({
          feedbackId: feedback.id,
          body: parsedReply.data.body,
          authorName: parsedReply.data.authorName ?? null,
          authorEmail: parsedReply.data.authorEmail ?? null,
        });

        const user = await con.getRepository(User).findOne({
          where: { id: feedback.userId },
          select: {
            id: true,
            email: true,
          },
        });

        if (user?.email && CioTransactionalMessageTemplateId.FeedbackReply) {
          await sendEmail({
            ...baseNotificationEmailData,
            transactional_message_id:
              CioTransactionalMessageTemplateId.FeedbackReply,
            reply_to: reply.authorEmail || 'support@daily.dev',
            identifiers: { id: feedback.userId },
            to: user.email,
            message_data: {
              author_name: reply.authorName || 'daily.dev team',
              reply_body: reply.body,
              feedback_description: feedback.description.slice(0, 200),
              feedback_url: `${process.env.COMMENTS_PREFIX}/settings/feedback`,
            },
          });
        }

        logLinearWebhookDebug({
          message: 'linear feedback reply processed',
          payload,
          extra: {
            commentId: comment.id,
            feedbackId: feedback.id,
            issueId,
            isReply: Boolean(comment.parentId),
          },
        });
        return res.status(200).send({ success: true });
      }

      if (!issueId) {
        logLinearWebhookDebug({
          message: 'linear issue webhook missing issue id',
          payload,
        });
        return res.status(200).send({ success: true });
      }

      if (payload.action !== 'update' || !payload.updatedFrom?.stateId) {
        logLinearWebhookDebug({
          message: 'linear webhook ignored issue event without state change',
          payload,
          extra: { issueId },
        });
        return res.status(200).send({ success: true });
      }

      const newStateName = payload.data.state?.name;

      if (!newStateName) {
        logLinearWebhookDebug({
          message: 'linear issue webhook missing state name',
          payload,
          extra: { issueId },
        });
        return res.status(200).send({ success: true });
      }

      const newStatus = linearStateToFeedbackStatus[newStateName];
      if (newStatus === undefined) {
        logLinearWebhookDebug({
          message: 'linear webhook ignored unmapped issue state',
          payload,
          extra: {
            issueId,
            stateName: newStateName,
          },
        });
        return res.status(200).send({ success: true });
      }

      const con = await createOrGetConnection();
      const feedback = await con.getRepository(Feedback).findOne({
        where: { linearIssueId: issueId },
      });

      if (!feedback) {
        logLinearWebhookDebug({
          message: 'linear issue webhook ignored non-feedback issue',
          payload,
          extra: { issueId },
        });
        return res.status(200).send({ success: true });
      }

      if (feedback.status === newStatus) {
        logLinearWebhookDebug({
          message: 'linear webhook ignored unchanged feedback status',
          payload,
          extra: {
            feedbackId: feedback.id,
            issueId,
            status: feedback.status,
          },
        });
        return res.status(200).send({ success: true });
      }

      await con.transaction(async (manager) => {
        await manager
          .getRepository(Feedback)
          .update({ id: feedback.id }, { status: newStatus });

        const ctx:
          | NotificationFeedbackResolvedContext
          | NotificationFeedbackCancelledContext = {
          userIds: [feedback.userId],
          feedbackId: feedback.id,
          feedbackDescription: feedback.description,
        };
        const notificationType = feedbackStatusToNotificationType[newStatus];

        if (notificationType) {
          const bundle = generateNotificationV2(notificationType, ctx);
          await storeNotificationBundleV2(manager, bundle);
        }
      });

      logLinearWebhookDebug({
        message: 'linear feedback status updated from webhook',
        payload,
        extra: {
          feedbackId: feedback.id,
          issueId,
          fromStatus: feedback.status,
          toStatus: newStatus,
        },
      });

      return res.status(200).send({ success: true });
    },
  });
};
