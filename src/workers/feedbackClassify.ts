import { TypedWorker } from './worker';
import { Feedback, FeedbackStatus } from '../entity';
import { getBragiClient } from '../integrations/bragi';
import { createFeedbackIssue } from '../integrations/linear';

/**
 * Worker that processes new feedback submissions:
 * 1. Calls Bragi for classification
 * 2. Creates Linear issue with classification metadata
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

      // Fetch the full feedback record
      const feedback = await repo.findOneBy({ id: feedbackId });
      if (!feedback) {
        logger.info(logDetails, 'Feedback not found, skipping');
        return;
      }

      // Skip if already processed or in spam status
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

      // Mark as processing
      await repo.update(feedbackId, { status: FeedbackStatus.Processing });

      // Call Bragi for classification
      let classification = null;
      try {
        const bragiClient = getBragiClient();
        const response = await bragiClient.garmr.execute(async () =>
          bragiClient.instance.parseFeedback({
            feedback: feedback.description,
          }),
        );

        if (response.classification) {
          classification = {
            platform: response.classification.platform?.toString(),
            category: response.classification.category?.toString(),
            sentiment: response.classification.sentiment?.toString(),
            urgency: response.classification.urgency?.toString(),
          };
        }

        logger.info({ ...logDetails, classification }, 'Feedback classified');
      } catch (err) {
        logger.warn(
          { ...logDetails, err },
          'Failed to classify feedback, continuing without classification',
        );
      }

      // Update feedback with classification
      await repo.update(feedbackId, {
        classification,
      });

      // Create Linear issue
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
          logger.info(
            { ...logDetails, linearIssueId, linearIssueUrl },
            'Linear issue created',
          );
        } else {
          logger.warn(
            logDetails,
            'Linear issue not created (client not configured)',
          );
        }
      } catch (err) {
        logger.error({ ...logDetails, err }, 'Failed to create Linear issue');
      }

      // Update feedback with Linear issue info and mark completed
      await repo.update(feedbackId, {
        linearIssueId,
        linearIssueUrl,
        status: FeedbackStatus.Completed,
      });

      logger.info(logDetails, 'Feedback processed successfully');
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to process feedback');

      // Mark as failed
      try {
        await con
          .getRepository(Feedback)
          .update(feedbackId, { status: FeedbackStatus.Failed });
      } catch (updateErr) {
        logger.error(
          { ...logDetails, err: updateErr },
          'Failed to update feedback status to failed',
        );
      }

      throw err;
    }
  },
};

export default worker;
