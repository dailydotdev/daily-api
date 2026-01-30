import { UserFeedbackCategory } from '@dailydotdev/schema';
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
 * If any step fails, the entire process fails and will be retried.
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
      const category =
        UserFeedbackCategory[
          feedback.category as keyof typeof UserFeedbackCategory
        ];
      const response = await bragiClient.garmr.execute(async () =>
        bragiClient.instance.classifyUserFeedback({
          category,
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

      // Only wrap the write in transaction
      await con.transaction(async (entityManager) => {
        await entityManager.getRepository(Feedback).update(feedbackId, {
          status: FeedbackStatus.Completed,
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
