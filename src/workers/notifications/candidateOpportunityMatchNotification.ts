import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { logger } from '../../logger';
import { TypeORMQueryFailedError } from '../../errors';

export const candidateOpportunityMatchNotification =
  generateTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>({
    subscription: 'api.candidate-opportunity-match-notification',
    handler: async (data) => {
      if (process.env.NODE_ENV === 'development') {
        return;
      }

      try {
        const { userId, opportunityId, reasoning } = data;
        if (!userId || !opportunityId) {
          logger.warn(
            { data },
            'Missing userId or opportunityId in candidate opportunity match notification',
          );
          return;
        }

        return [
          {
            type: NotificationType.NewOpportunityMatch,
            ctx: {
              userIds: [userId],
              opportunityId,
              reasoning,
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
  });
