import { TypedWorker } from './worker';
import { Feedback, FeedbackStatus } from '../entity/Feedback';
import { User } from '../entity/user';
import { slackClient } from '../common/slack';
import { getCategoryDisplayName, getSentimentEmoji } from '../common/feedback';
import { updateFlagsStatement } from '../common/utils';
import type { Block, KnownBlock, MrkdwnElement } from '@slack/web-api';

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

    if (feedback.status === FeedbackStatus.Accepted) {
      if (feedback.flags?.slackNotifiedAt) {
        return;
      }

      const slackUserFeedbackChannelId =
        process.env.SLACK_USER_FEEDBACK_CHANNEL_ID;

      if (!slackUserFeedbackChannelId) {
        logger.warn(logDetails, 'Feedback slack channel id is not configured');
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

      if (feedback.screenshotUrl) {
        blocks.push({
          type: 'image',
          image_url: feedback.screenshotUrl,
          alt_text: 'User feedback screenshot',
        });
      }

      blocks.push({
        type: 'divider',
      });

      try {
        const slackMessage = await slackClient.postMessage({
          channel: slackUserFeedbackChannelId,
          text: 'New user feedback processed',
          blocks,
        });

        await con.getRepository(Feedback).update(feedbackId, {
          flags: updateFlagsStatement<Feedback>({
            slackNotifiedAt: new Date().toISOString(),
            slackMessageTs: slackMessage.ts ?? undefined,
            slackChannelId: slackMessage.channel ?? undefined,
          }),
        });
      } catch (err) {
        logger.error(
          { ...logDetails, err },
          'Failed to send feedback slack notification',
        );
      }

      return;
    }

    if (
      ![FeedbackStatus.Completed, FeedbackStatus.Cancelled].includes(
        feedback.status,
      )
    ) {
      return;
    }

    if (feedback.flags?.slackClosedAt) {
      return;
    }

    if (!feedback.flags?.slackMessageTs || !feedback.flags?.slackChannelId) {
      logger.warn(
        logDetails,
        'Missing Slack message metadata, skipping feedback close update',
      );
      return;
    }

    const statusText =
      feedback.status === FeedbackStatus.Completed
        ? ':white_check_mark: Feedback Resolved'
        : ':no_entry_sign: Feedback Cancelled';

    const descriptionPreview =
      feedback.description.length > 300
        ? `${feedback.description.slice(0, 300)}...`
        : feedback.description;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: statusText,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User:*\n<https://app.daily.dev/${feedback.userId}|${feedback.userId}>`,
          },
          {
            type: 'mrkdwn',
            text: `*Category:*\n${getCategoryDisplayName(feedback.category)}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `~*Description:*~\n~${descriptionPreview}~`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Status changed on ${new Date().toISOString()}`,
          },
        ],
      },
    ];

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

    try {
      await slackClient.updateMessage({
        channel: feedback.flags.slackChannelId,
        ts: feedback.flags.slackMessageTs,
        text: statusText,
        blocks,
      });

      await con.getRepository(Feedback).update(feedbackId, {
        flags: updateFlagsStatement<Feedback>({
          slackClosedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      logger.error(
        { ...logDetails, err },
        'Failed to update feedback slack notification',
      );
    }
  },
};

export default worker;
