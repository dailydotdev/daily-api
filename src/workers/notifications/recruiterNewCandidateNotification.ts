import { TypedNotificationWorker } from '../worker';
import { User } from '../../entity';
import { OpportunityUser } from '../../entity/opportunities/user';
import { Opportunity } from '../../entity/opportunities/Opportunity';
import { OpportunityUserType } from '../../entity/opportunities/types';
import { NotificationType } from '../../notifications/common';
import { CandidateAcceptedOpportunityMessage } from '@dailydotdev/schema';

export const recruiterNewCandidateNotification: TypedNotificationWorker<'api.v1.candidate-accepted-opportunity'> =
  {
    subscription: 'api.recruiter-new-candidate-notification',
    handler: async (data, con, logger) => {
      const { opportunityId, userId } = data;

      try {
        // Fetch recruiters for the opportunity
        const opportunityUsers = await con.getRepository(OpportunityUser).find({
          where: {
            opportunityId,
            type: OpportunityUserType.Recruiter,
          },
        });

        const recruiterIds = opportunityUsers.map((ou) => ou.userId);

        if (recruiterIds.length === 0) {
          logger.warn({ opportunityId }, 'No recruiters found for opportunity');
          return [];
        }

        // Fetch candidate and opportunity info
        const [candidate, opportunity] = await Promise.all([
          con.getRepository(User).findOne({ where: { id: userId } }),
          con
            .getRepository(Opportunity)
            .findOne({ where: { id: opportunityId } }),
        ]);

        if (!candidate) {
          logger.warn({ userId }, 'Candidate not found');
          return [];
        }

        return [
          {
            type: NotificationType.RecruiterNewCandidate,
            ctx: {
              userIds: recruiterIds,
              opportunityId,
              candidate,
              opportunityTitle: opportunity?.title,
            },
          },
        ];
      } catch (err) {
        logger.error(
          { data, err },
          'failed to generate recruiter new candidate notification',
        );
        return [];
      }
    },
    parseMessage: (message) =>
      CandidateAcceptedOpportunityMessage.fromBinary(message.data),
  };
