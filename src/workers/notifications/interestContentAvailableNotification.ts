import { UserInterest } from '../../entity/UserInterest';
import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';

export const interestContentAvailableNotification: TypedNotificationWorker<'api.v1.interest-content-available'> =
  {
    subscription: 'api.interest-content-available-notification',
    handler: async (data, con) => {
      const { interestId, userId, count, runAt } = data;

      const interest = await con.getRepository(UserInterest).findOne({
        select: ['id', 'query'],
        where: { id: interestId, userId },
      });

      if (!interest) {
        return;
      }

      return [
        {
          type: NotificationType.InterestContentBatch,
          ctx: {
            interest: { id: interest.id, query: interest.query },
            count,
            userIds: [userId],
            dedupKey: `${interestId}:${runAt}`,
          },
        },
      ];
    },
  };
