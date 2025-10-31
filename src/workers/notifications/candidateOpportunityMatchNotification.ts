import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';
import { TypeORMQueryFailedError } from '../../errors';
import { MatchedCandidate } from '@dailydotdev/schema';
import { User } from '../../entity';

const candidateOpportunityMatchNotification: TypedNotificationWorker<'gondul.v1.candidate-opportunity-match'> =
  {
    subscription: 'api.candidate-opportunity-match-notification',
    handler: async (data, con, logger) => {
      try {
        const { userId, opportunityId, reasoningShort } = data;
        if (!userId || !opportunityId) {
          logger.warn(
            { data },
            'Missing userId or opportunityId in candidate opportunity match notification',
          );
          return;
        }

        const user = await con.getRepository(User).findOneBy({ id: userId });
        if (!user) {
          logger.error(
            { opportunityId, userId },
            'candidateOpportunityMatchNotification: User not found',
          );
          return;
        }

        return [
          {
            type: NotificationType.NewOpportunityMatch,
            ctx: {
              userIds: [userId],
              opportunityId,
              reasoningShort,
            },
          },
        ];
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;
        if (err?.name === 'QueryFailedError') {
          logger.error({ err, data }, 'could not store opportunity match');

          return;
        }

        throw err;
      }
    },
    parseMessage: (message) => {
      return MatchedCandidate.fromBinary(message.data);
    },
  };

export { candidateOpportunityMatchNotification };
