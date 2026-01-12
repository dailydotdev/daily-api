import { ConnectError } from '@connectrpc/connect';
import type { TypedWorker } from '../worker';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { getBragiClient } from '../../integrations/bragi';
import type {
  FeedbackClassification,
  OpportunityFeedback,
} from '../../common/schema/opportunityMatch';

export const parseOpportunityFeedbackWorker: TypedWorker<'api.v1.opportunity-feedback-submitted'> =
  {
    subscription: 'api.parse-opportunity-feedback',
    handler: async ({ data }, con, logger) => {
      const { opportunityId, userId } = data;

      const match = await con.getRepository(OpportunityMatch).findOne({
        where: { opportunityId, userId },
        select: ['opportunityId', 'userId', 'feedback'],
      });

      if (!match) {
        logger.warn({ opportunityId, userId }, 'No match found for feedback');
        return;
      }

      if (!match.feedback?.length) {
        logger.debug({ opportunityId, userId }, 'No feedback to parse');
        return;
      }

      const bragiClient = getBragiClient();

      const updatedFeedback: OpportunityFeedback[] = await Promise.all(
        match.feedback.map(async (item) => {
          if (item.classification) {
            return item;
          }

          try {
            const result = await bragiClient.garmr.execute(() =>
              bragiClient.instance.parseFeedback({ feedback: item.answer }),
            );
            const classification = result.classification;

            if (!classification) {
              logger.warn(
                { opportunityId, userId, answer: item.answer },
                'No classification returned from Bragi',
              );
              return item;
            }

            const feedbackClassification: FeedbackClassification = {
              platform: classification.platform,
              category: classification.category,
              sentiment: classification.sentiment,
              urgency: classification.urgency,
            };

            return {
              ...item,
              classification: feedbackClassification,
            };
          } catch (err) {
            if (err instanceof ConnectError) {
              logger.error(
                { err, opportunityId, userId, answer: item.answer },
                'ConnectError when parsing feedback',
              );
              return item;
            }
            throw err;
          }
        }),
      );

      await con
        .getRepository(OpportunityMatch)
        .update({ opportunityId, userId }, { feedback: updatedFeedback });

      logger.info(
        { opportunityId, userId },
        'Successfully parsed opportunity feedback',
      );
    },
  };
