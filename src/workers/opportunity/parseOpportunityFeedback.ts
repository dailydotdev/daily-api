import { ConnectError } from '@connectrpc/connect';
import type { TypedWorker } from '../worker';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { Opportunity } from '../../entity/opportunities/Opportunity';
import { getBragiClient } from '../../integrations/bragi';
import type {
  FeedbackClassification,
  OpportunityFeedback,
  RejectionFeedbackClassification,
  RejectionReasonDetail,
} from '../../common/schema/opportunityMatch';

type OneofPreference = {
  case?: string;
  value?: unknown;
};

const mapPreferenceFields = (
  preference?: OneofPreference,
): Partial<RejectionReasonDetail> => {
  if (!preference) {
    return {};
  }
  switch (preference.case) {
    case 'locationTypePreference':
      return { locationTypePreference: preference.value as number };
    case 'seniorityPreference':
      return { seniorityPreference: preference.value as number };
    case 'employmentTypePreference':
      return { employmentTypePreference: preference.value as number };
    case 'freeTextPreference':
      return { freeTextPreference: preference.value as string };
    default:
      return {};
  }
};

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

      // Skip rejection classification if already set (idempotent)
      if (match.rejectionClassification) {
        return;
      }

      try {
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
          logger.warn(
            { opportunityId, userId },
            'No rejection classification returned from Bragi',
          );
          return;
        }

        const rejectionClassification: RejectionFeedbackClassification = {
          reasons: result.classification.reasons.map((r) => ({
            reason: r.reason,
            confidence: r.confidence,
            explanation: r.explanation,
            ...mapPreferenceFields(r.preference),
          })),
          summary: result.classification.summary,
        };

        await con
          .getRepository(OpportunityMatch)
          .update({ opportunityId, userId }, { rejectionClassification });

        logger.info(
          { opportunityId, userId },
          'Successfully classified rejection feedback',
        );
      } catch (err) {
        if (err instanceof ConnectError) {
          logger.error(
            { err, opportunityId, userId },
            'ConnectError when classifying rejection feedback',
          );
          return;
        }
        throw err;
      }
    },
  };
