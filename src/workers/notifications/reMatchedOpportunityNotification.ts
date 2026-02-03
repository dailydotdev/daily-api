import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';
import { MatchedCandidate } from '@dailydotdev/schema';
import { User } from '../../entity';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { OpportunityMatchStatus } from '../../entity/opportunities/types';

const reMatchedOpportunityNotification: TypedNotificationWorker<'gondul.v1.candidate-opportunity-match'> =
  {
    subscription: 'api.rematched-opportunity-notification',
    handler: async (data, con, logger) => {
      const { userId, opportunityId, reasoningShort } = data;

      if (!userId || !opportunityId) {
        logger.warn(
          { data },
          'Missing userId or opportunityId in re-match notification',
        );
        return;
      }

      // Only handle re-matches (existing match with candidate_rejected status)
      const existingMatch = await con.getRepository(OpportunityMatch).findOne({
        where: { userId, opportunityId },
        select: ['userId', 'opportunityId', 'status'],
      });

      if (existingMatch?.status !== OpportunityMatchStatus.CandidateRejected) {
        // Not a re-match - skip (handled by candidateOpportunityMatchNotification)
        return;
      }

      const user: Pick<User, 'id'> | null = await con
        .getRepository(User)
        .findOne({ select: ['id'], where: { id: userId } });

      if (!user) {
        return;
      }

      return [
        {
          type: NotificationType.ReMatchedOpportunity,
          ctx: {
            userIds: [user.id],
            opportunityId,
            reasoningShort,
          },
        },
      ];
    },
    parseMessage: (message) => {
      return MatchedCandidate.fromBinary(message.data);
    },
  };

export { reMatchedOpportunityNotification };
