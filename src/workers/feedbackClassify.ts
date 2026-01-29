import { TypedWorker } from './worker';
import { Feedback } from '../entity/Feedback';
import { getBragiClient } from '../integrations/bragi';
import { createFeedbackIssue } from '../integrations/linear';

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

      if (feedback.status === 'spam') {
        logger.info(logDetails, 'Feedback is spam, skipping');
        return;
      }

      if (feedback.status !== 'pending') {
        logger.info(
          { ...logDetails, status: feedback.status },
          'Feedback already processed, skipping',
        );
        return;
      }

      await repo.update(feedbackId, { status: 'processing' });

      // Attempt classification (optional - Garmr handles retries)
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
        status: 'completed',
      });
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to process feedback');
      throw err;
    }
  },
};

export default worker;
