import { TypedWorker } from './worker';
import { Feedback, FeedbackStatus } from '../entity/Feedback';
import { User } from '../entity/user/User';
import { getBragiClient } from '../integrations/bragi';
import { createFeedbackIssue } from '../integrations/linear';
import { webhooks } from '../common/slack';
import { getCategoryDisplayName, getSentimentEmoji } from '../common/feedback';
import { updateFlagsStatement } from '../common/utils';
import type { Block, KnownBlock, MrkdwnElement } from '@slack/web-api';

/**
 * Worker that processes new feedback submissions:
 * 1. Calls Bragi for classification
 * 2. Creates Linear issue with classification metadata
 * 3. Sends Slack notification
 * 4. Updates feedback record with classification, Linear issue info, and notification flag
 *
 * If any step fails, the entire process fails and will be retried.
 * The slackNotifiedAt flag prevents duplicate notifications on retries.
 */
const worker: TypedWorker<'api.v1.feedback-created'> = {
  subscription: 'api.feedback-classify',
  handler: async (message, con, logger): Promise<void> => {
    const { data } = message;
    const { feedbackId } = data;
    const logDetails = { feedbackId, messageId: message.messageId };

    try {
      // Read outside transaction
      const feedback = await con.getRepository(Feedback).findOneBy({
        id: feedbackId,
      });

      if (!feedback) {
        logger.info(logDetails, 'Feedback not found, skipping');
        return;
      }

      if (feedback.status === FeedbackStatus.Spam) {
        logger.info(logDetails, 'Feedback is spam, skipping');
        return;
      }

      if (feedback.status !== FeedbackStatus.Pending) {
        logger.info(
          { ...logDetails, status: feedback.status },
          'Feedback already processed, skipping',
        );
        return;
      }

      // Check if notification was already sent (idempotency for retries)
      if (feedback.flags?.slackNotifiedAt) {
        logger.info(logDetails, 'Slack notification already sent, skipping');
        return;
      }

      // External API calls outside transaction
      const bragiClient = getBragiClient();

      const response = await bragiClient.garmr.execute(async () =>
        bragiClient.instance.classifyUserFeedback({
          category: feedback.category,
          description: feedback.description,
          pageUrl: feedback.pageUrl ?? undefined,
          userAgent: feedback.userAgent ?? undefined,
        }),
      );
      console.info(
        { ...logDetails, response },
        'Bragi classification response',
      );

      const classification = response.classification
        ? {
            sentiment: response.classification.sentiment?.toString(),
            urgency: response.classification.urgency?.toString(),
            tags: response.classification.tags,
            summary: response.classification.summary,
            hasPromptInjection: response.classification.hasPromptInjection,
            suggestedTeam: response.classification.suggestedTeam?.toString(),
          }
        : null;

      const issue = await createFeedbackIssue({
        feedbackId,
        userId: feedback.userId,
        category: feedback.category,
        description: feedback.description,
        pageUrl: feedback.pageUrl,
        classification,
      });

      if (!issue) {
        throw new Error('Linear client not configured');
      }

      // Send Slack notification (before DB update so retries work correctly)
      if (process.env.NODE_ENV !== 'development') {
        const user = await con.getRepository(User).findOneBy({
          id: feedback.userId,
        });

        const userProfileLink = `<https://app.daily.dev/${feedback.userId}|${user?.username || feedback.userId}>`;

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

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Linear Issue:*\n<${issue.url}|View in Linear>`,
          },
        });

        blocks.push({
          type: 'divider',
        });

        await webhooks.userFeedback.send({
          text: 'New user feedback processed',
          blocks,
        });
      }

      // Only wrap the write in transaction
      await con.transaction(async (entityManager) => {
        await entityManager.getRepository(Feedback).update(feedbackId, {
          status: FeedbackStatus.Accepted,
          classification,
          linearIssueId: issue.id,
          linearIssueUrl: issue.url,
          flags: updateFlagsStatement<Feedback>({
            slackNotifiedAt: new Date().toISOString(),
          }),
        });
      });
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to process feedback');
      throw err;
    }
  },
};

export default worker;
