import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
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
import { z } from 'zod';

// Linear state name to FeedbackStatus mapping
const linearStateToFeedbackStatus: Record<string, FeedbackStatus> = {
  Done: FeedbackStatus.Completed,
  Canceled: FeedbackStatus.Cancelled,
};

const feedbackStatusToNotificationType: Partial<
  Record<FeedbackStatus, NotificationType>
> = {
  [FeedbackStatus.Completed]: NotificationType.FeedbackResolved,
  [FeedbackStatus.Cancelled]: NotificationType.FeedbackCancelled,
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
        req.log.debug({ error: parseResult.error }, 'Invalid webhook payload');
        return res.status(200).send({ success: true });
      }

      const payload = parseResult.data;

      const con = await createOrGetConnection();

      if (payload.type === 'Comment') {
        const comment = payload.data;
        const commentBody = comment.body.trim();
        const replyPrefix = /^@reply\b/i;

        if (!replyPrefix.test(commentBody)) {
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
          return res.status(200).send({ success: true });
        }

        const feedback = await con.getRepository(Feedback).findOne({
          where: { linearIssueId: comment.issue.id },
          select: ['id', 'description', 'userId'],
        });

        if (!feedback) {
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
          select: ['id', 'email'],
        });

        if (user?.email) {
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

        return res.status(200).send({ success: true });
      }

      // Only handle Issue update events with state changes
      if (payload.action !== 'update' || !payload.updatedFrom?.stateId) {
        return res.status(200).send({ success: true });
      }

      const issueId = payload.data.id;
      const newStateName = payload.data.state?.name;

      if (!newStateName) {
        return res.status(200).send({ success: true });
      }

      const newStatus = linearStateToFeedbackStatus[newStateName];
      if (newStatus === undefined) {
        // State not mapped, ignore
        return res.status(200).send({ success: true });
      }

      // Find feedback by Linear issue ID
      const feedback = await con.getRepository(Feedback).findOne({
        where: { linearIssueId: issueId },
      });

      if (!feedback) {
        // Not a feedback-related issue, ignore
        return res.status(200).send({ success: true });
      }

      // Check if status actually changed
      if (feedback.status === newStatus) {
        return res.status(200).send({ success: true });
      }

      // Update feedback status and generate notification in a transaction
      await con.transaction(async (manager) => {
        await manager
          .getRepository(Feedback)
          .update({ id: feedback.id }, { status: newStatus });

        const notificationType = feedbackStatusToNotificationType[newStatus];
        if (notificationType) {
          const ctx:
            | NotificationFeedbackResolvedContext
            | NotificationFeedbackCancelledContext = {
            userIds: [feedback.userId],
            feedbackId: feedback.id,
            feedbackDescription: feedback.description,
          };
          const bundle = generateNotificationV2(notificationType, ctx);
          await storeNotificationBundleV2(manager, bundle);
        }
      });

      return res.status(200).send({ success: true });
    },
  });
};
