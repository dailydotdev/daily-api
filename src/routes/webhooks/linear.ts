import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import createOrGetConnection from '../../db';
import { Feedback, FeedbackStatus } from '../../entity/Feedback';
import { logger } from '../../logger';
import { WebhookPayload } from '../../types';
import {
  linearWebhookPayloadSchema,
  type LinearWebhookPayload,
} from '../../common/schema/linearWebhook';
import {
  generateNotificationV2,
  storeNotificationBundleV2,
  type NotificationFeedbackResolvedContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';

// Linear state name to FeedbackStatus mapping
const linearStateToFeedbackStatus: Record<string, FeedbackStatus> = {
  'In Progress': FeedbackStatus.Accepted,
  Done: FeedbackStatus.Completed,
  Canceled: FeedbackStatus.Cancelled,
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
        return res.status(500).send({ error: 'Webhook not configured' });
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

      // Only handle Issue update events with state changes
      if (
        payload.type !== 'Issue' ||
        payload.action !== 'update' ||
        !payload.updatedFrom?.stateId
      ) {
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

      const con = await createOrGetConnection();

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

      // Update feedback status
      await con
        .getRepository(Feedback)
        .update({ id: feedback.id }, { status: newStatus });

      // Generate notification if status changed to Completed
      if (newStatus === FeedbackStatus.Completed) {
        await con.transaction(async (manager) => {
          const ctx: NotificationFeedbackResolvedContext = {
            userIds: [feedback.userId],
            feedbackId: feedback.id,
            feedbackDescription: feedback.description,
          };
          const bundle = generateNotificationV2(
            NotificationType.FeedbackResolved,
            ctx,
          );
          await storeNotificationBundleV2(manager, bundle);
        });
      }

      return res.status(200).send({ success: true });
    },
  });
};
