import { TypedNotificationWorker } from '../worker';
import { User } from '../../entity';
import { OpportunityUser } from '../../entity/opportunities/user';
import { Opportunity } from '../../entity/opportunities/Opportunity';
import { OpportunityUserType } from '../../entity/opportunities/types';
import { NotificationType } from '../../notifications/common';
import { CandidateAcceptedOpportunityMessage } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { OpportunityKeyword } from '../../entity/OpportunityKeyword';

export const recruiterNewCandidateNotification: TypedNotificationWorker<'api.v1.candidate-accepted-opportunity'> =
  {
    subscription: 'api.recruiter-new-candidate-notification',
    handler: async (data, con, logger) => {
      const { opportunityId, userId } = data;

      try {
        // Fetch recruiters for the opportunity
        const opportunityUsers = await con.getRepository(OpportunityUser).find({
          select: ['userId'],
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

        // Fetch candidate, opportunity, match, and keywords info
        const [candidate, opportunity, match, keywords] = await Promise.all([
          con.getRepository(User).findOne({
            where: { id: userId },
            select: ['id', 'name', 'username'],
          }),
          con
            .getRepository(Opportunity)
            .findOne({ where: { id: opportunityId } }),
          con.getRepository(OpportunityMatch).findOne({
            where: { opportunityId, userId },
            select: ['description'],
          }),
          con.getRepository(OpportunityKeyword).find({
            where: { opportunityId },
            select: ['keyword'],
          }),
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
              matchScore: match?.description?.matchScore,
              reasoning: match?.description?.reasoning,
              reasoningShort: match?.description?.reasoningShort,
              keywords: keywords.map((k) => k.keyword),
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
