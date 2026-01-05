import { TypedWorker } from './worker';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';
import { webhooks } from '../common';
import { CandidateAcceptedOpportunityMessage } from '@dailydotdev/schema';

const worker: TypedWorker<'api.v1.candidate-accepted-opportunity'> = {
  subscription: 'api.candidate-accepted-opportunity-slack',
  handler: async ({ data }, con, logger): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const { opportunityId, userId } = data;

    try {
      // Fetch the match details to get additional context
      const match = await con.getRepository(OpportunityMatch).findOne({
        where: { opportunityId, userId },
        relations: ['opportunity', 'user'],
      });

      if (!match) {
        logger.warn(
          { opportunityId, userId },
          'Match not found for candidate accepted opportunity',
        );
        return;
      }

      const opportunity = await match.opportunity;
      const user = await match.user;

      let organizationName = 'N/A';
      if (opportunity instanceof OpportunityJob && opportunity.organizationId) {
        const organization = await opportunity.organization;
        organizationName = organization?.name || 'N/A';
      }

      await webhooks.recruiter.send({
        text: 'Candidate accepted opportunity!',
        attachments: [
          {
            title: opportunity?.title || `Opportunity: ${opportunityId}`,
            title_link: `${process.env.COMMENTS_PREFIX}/jobs/${opportunityId}`,
            fields: [
              {
                title: 'User',
                value: user?.username || userId,
              },
              {
                title: 'User ID',
                value: userId,
              },
              {
                title: 'Opportunity ID',
                value: opportunityId,
              },
              {
                title: 'Company name',
                value: organizationName,
              },
            ],
            color: '#1DDC6F',
          },
        ],
      });
    } catch (err) {
      logger.error(
        { data, err },
        'failed to send candidate accepted opportunity slack message',
      );
    }
  },
  parseMessage: (message) =>
    CandidateAcceptedOpportunityMessage.fromBinary(message.data),
};

export default worker;
