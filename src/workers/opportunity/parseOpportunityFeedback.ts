import type { TypedWorker } from '../worker';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { Opportunity } from '../../entity/opportunities/Opportunity';
import { getBragiClient } from '../../integrations/bragi';
import {
  feedbackClassificationSchema,
  opportunityFeedbackSchema,
  rejectionFeedbackClassificationSchema,
} from '../../common/schema/opportunityMatch';
import type z from 'zod';

export const parseOpportunityFeedbackWorker: TypedWorker<'api.v1.opportunity-feedback-submitted'> =
  {
    subscription: 'api.parse-opportunity-feedback',
    handler: async ({ data }, con, logger) => {
      const { opportunityId, userId } = data;

      const match = await con.getRepository(OpportunityMatch).findOne({
        where: { opportunityId, userId },
        select: [
          'opportunityId',
          'userId',
          'feedback',
          'rejectionClassification',
        ],
      });

      if (!match) {
        logger.debug({ opportunityId, userId }, 'No match found for feedback');
        return;
      }

      if (!match.feedback?.length) {
        logger.debug({ opportunityId, userId }, 'No feedback to parse');
        return;
      }

      const bragiClient = getBragiClient();

      const updatedFeedback: Array<z.infer<typeof opportunityFeedbackSchema>> =
        await Promise.all(
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
                logger.debug(
                  { opportunityId, userId, answer: item.answer },
                  'No classification returned from Bragi',
                );
                return item;
              }

              const feedbackClassification: z.infer<
                typeof feedbackClassificationSchema
              > = {
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
              logger.debug(
                { err, opportunityId, userId, answer: item.answer },
                'Error when parsing feedback',
              );
              return item;
            }
          }),
        );

      await con
        .getRepository(OpportunityMatch)
        .update({ opportunityId, userId }, { feedback: updatedFeedback });

      const feedback = match.feedback
        .map((item) => `Q: ${item.screening}\nA: ${item.answer}`)
        .join('\n\n');

      const opportunity = await con.getRepository(Opportunity).findOne({
        where: { id: opportunityId },
        select: ['id', 'title', 'tldr'],
      });

      const jobContext = opportunity
        ? `${opportunity.title}\n${opportunity.tldr}`
        : undefined;

      const result = await bragiClient.garmr.execute(() =>
        bragiClient.instance.classifyRejectionFeedback({
          feedback,
          jobContext,
        }),
      );

      if (!result?.classification) {
        logger.debug(
          { opportunityId, userId },
          'No rejection classification returned from Bragi',
        );
        return;
      }

      const rejectionClassification: z.infer<
        typeof rejectionFeedbackClassificationSchema
      > = {
        reasons: result.classification.reasons.map((reason) => {
          let preference = {};
          if (reason.preference?.case) {
            switch (reason.preference.case) {
              case 'locationTypePreference':
                preference = {
                  locationTypePreference: reason.preference.value,
                };
                break;
              case 'seniorityPreference':
                preference = {
                  seniorityPreference: reason.preference.value,
                };
                break;
              case 'employmentTypePreference':
                preference = {
                  employmentTypePreference: reason.preference.value,
                };
                break;
              case 'freeTextPreference':
                preference = {
                  freeTextPreference: reason.preference.value,
                };
                break;
            }
          }

          return {
            reason: reason.reason,
            confidence: reason.confidence,
            explanation: reason.explanation,
            ...preference,
          };
        }),
        summary: result.classification.summary,
      };

      await con
        .getRepository(OpportunityMatch)
        .update({ opportunityId, userId }, { rejectionClassification });
    },
  };
