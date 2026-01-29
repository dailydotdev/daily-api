import { UserFeedbackCategory } from '@dailydotdev/schema';
import { TypedWorker } from './worker';
import { Feedback, FeedbackCategory, FeedbackStatus } from '../entity/Feedback';
import { getBragiClient } from '../integrations/bragi';
import { createFeedbackIssue } from '../integrations/linear';

const mapCategoryToProto = (
  category: FeedbackCategory,
): UserFeedbackCategory => {
  switch (category) {
    case FeedbackCategory.Bug:
      return UserFeedbackCategory.BUG;
    case FeedbackCategory.FeatureRequest:
      return UserFeedbackCategory.FEATURE_REQUEST;
    case FeedbackCategory.General:
      return UserFeedbackCategory.GENERAL;
    case FeedbackCategory.Other:
      return UserFeedbackCategory.OTHER;
    default:
      return UserFeedbackCategory.UNSPECIFIED;
  }
};

/**
 * Worker that processes new feedback submissions:
 * 1. Calls Bragi for classification (optional - continues if fails)
 * 2. Creates Linear issue with classification metadata (optional - continues if fails)
 * 3. Updates feedback record with classification and Linear issue info
 */
const worker: TypedWorker<'api.v1.feedback-created'> = {
  subscription: 'api.feedback-classify',
  handler: async (message, con, logger): Promise<void> => {
    const { data } = message;
    const feedbackId = data.feedback.id;
    const logDetails = { feedbackId, messageId: message.messageId };

    try {
      const repo = con.getRepository(Feedback);
      const feedback = await repo.findOneBy({ id: feedbackId });

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

      await repo.update(feedbackId, { status: FeedbackStatus.Processing });

      // Attempt classification (optional - Garmr handles retries)
      let classification = null;
      try {
        const bragiClient = getBragiClient();
        const response = await bragiClient.garmr.execute(async () =>
          bragiClient.instance.classifyUserFeedback({
            category: mapCategoryToProto(feedback.category),
            description: feedback.description,
            pageUrl: feedback.pageUrl ?? undefined,
            userAgent: feedback.userAgent ?? undefined,
          }),
        );

        if (response.classification) {
          classification = {
            sentiment: response.classification.sentiment?.toString(),
            urgency: response.classification.urgency?.toString(),
            tags: response.classification.tags,
            summary: response.classification.summary,
            hasPromptInjection: response.classification.hasPromptInjection,
            suggestedTeam: response.classification.suggestedTeam?.toString(),
          };
        }
      } catch (err) {
        logger.warn(
          { ...logDetails, err },
          'Classification failed, continuing without it',
        );
      }

      await repo.update(feedbackId, { classification });

      // Attempt Linear issue creation (optional - Garmr handles retries)
      let linearIssueId = null;
      let linearIssueUrl = null;

      try {
        const issue = await createFeedbackIssue({
          feedbackId,
          userId: feedback.userId,
          category: feedback.category,
          description: feedback.description,
          pageUrl: feedback.pageUrl,
          classification,
        });

        if (issue) {
          linearIssueId = issue.id;
          linearIssueUrl = issue.url;
        } else {
          logger.warn(logDetails, 'Linear client not configured');
        }
      } catch (err) {
        logger.error(
          { ...logDetails, err },
          'Linear issue creation failed, continuing without it',
        );
      }

      await repo.update(feedbackId, {
        linearIssueId,
        linearIssueUrl,
        status: FeedbackStatus.Completed,
      });
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to process feedback');
      throw err;
    }
  },
};

export default worker;
