import { TypedWorker } from './worker';
import { Feedback, FeedbackStatus } from '../entity/Feedback';
import { User } from '../entity/user';
import { webhooks } from '../common/slack';
import { getCategoryDisplayName, getSentimentEmoji } from '../common/feedback';
import { updateFlagsStatement } from '../common/utils';
import type { Block, KnownBlock, MrkdwnElement } from '@slack/web-api';

/**
 * Worker that sends Slack notifications for accepted feedback.
 * Listens to feedback-updated CDC events and sends notification when:
 * - Status is Accepted
 * - Slack notification hasn't been sent yet (slackNotifiedAt flag)
 *
 * The slackNotifiedAt flag provides idempotency for retries.
 */
const worker: TypedWorker<'api.v1.feedback-updated'> = {
  subscription: 'api.feedback-updated-slack',
  handler: async ({ data }, con, logger): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const { feedbackId } = data;
    const logDetails = { feedbackId };

    const feedback = await con.getRepository(Feedback).findOneBy({
      id: feedbackId,
    });

    if (!feedback) {
      logger.warn(logDetails, 'Feedback not found for slack notification');
      return;
    }

    // Only send notification for Accepted status
    if (feedback.status !== FeedbackStatus.Accepted) {
      return;
    }

    // Check if notification was already sent (idempotency for retries)
    if (feedback.flags?.slackNotifiedAt) {
      logger.info(logDetails, 'Slack notification already sent, skipping');
      return;
    }

    const user = await con.getRepository(User).findOneBy({
      id: feedback.userId,
    });

    const userProfileLink = `<https://app.daily.dev/${feedback.userId}|${user?.username || feedback.userId}>`;
    const classification = feedback.classification;

    const fields: MrkdwnElement[] = [
      {
        type: 'mrkdwn',
        text: `*User:*\n${userProfileLink}`,
      },
      {
        type: 'mrkdwn',
        text: `*Category:*\n${getCategoryDisplayName(feedback.category)}`,
      },
    ];

    if (classification?.sentiment) {
      fields.push({
        type: 'mrkdwn',
        text: `*Sentiment:*\n${getSentimentEmoji(classification.sentiment)}`,
      });
    }

    if (classification?.urgency) {
      fields.push({
        type: 'mrkdwn',
        text: `*Urgency:*\n${classification.urgency}`,
      });
    }

    const blocks: (Block | KnownBlock)[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':memo: New User Feedback Processed',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields,
      },
    ];

    if (classification?.summary) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:*\n${classification.summary}`,
        },
      });
    }

    const descriptionPreview =
      feedback.description.length > 300
        ? `${feedback.description.slice(0, 300)}...`
        : feedback.description;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Description:*\n${descriptionPreview}`,
      },
    });

    if (feedback.pageUrl) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Page URL:*\n<${feedback.pageUrl}|${feedback.pageUrl}>`,
        },
      });
    }

    if (classification?.tags && classification.tags.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Tags:*\n${classification.tags.join(', ')}`,
        },
      });
    }

    if (feedback.linearIssueUrl) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Linear Issue:*\n<${feedback.linearIssueUrl}|View in Linear>`,
        },
      });
    }

    blocks.push({
      type: 'divider',
    });

    await webhooks.userFeedback.send({
      text: 'New user feedback processed',
      blocks,
    });

    // Update flag to mark notification as sent
    await con.transaction(async (entityManager) => {
      await entityManager.getRepository(Feedback).update(feedbackId, {
        flags: updateFlagsStatement<Feedback>({
          slackNotifiedAt: new Date().toISOString(),
        }),
      });
    });
  },
};

export default worker;
