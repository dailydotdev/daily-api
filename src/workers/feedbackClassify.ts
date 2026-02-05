import { TypedWorker } from './worker';
import { Feedback, FeedbackStatus } from '../entity/Feedback';
import { getBragiClient } from '../integrations/bragi';
import { createFeedbackIssue } from '../integrations/linear';

/**
 * Worker that processes new feedback submissions:
 * 1. Calls Bragi for classification
 * 2. Creates Linear issue with classification metadata
 * 3. Updates feedback record with classification and Linear issue info
 *
 * Status is set to Accepted, which triggers a CDC event that the
 * feedbackUpdatedSlack worker listens to for sending Slack notifications.
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
        screenshotUrl: feedback.screenshotUrl,
      });

      if (!issue) {
        throw new Error('Linear client not configured');
      }

      // Update feedback with classification and Linear issue info
      // Status change to Accepted triggers CDC event for Slack notification
      await con.transaction(async (entityManager) => {
        await entityManager.getRepository(Feedback).update(feedbackId, {
          status: FeedbackStatus.Accepted,
          classification,
          linearIssueId: issue.id,
          linearIssueUrl: issue.url,
        });
      });
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to process feedback');
      throw err;
    }
  },
};

export default worker;
