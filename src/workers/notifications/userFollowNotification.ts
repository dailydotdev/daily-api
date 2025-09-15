import { whereNotUserBlocked } from '../../common/contentPreference';
import { whereVordrFilter } from '../../common/vordr';
import { User } from '../../entity/user/User';
import { NotificationType } from '../../notifications/common';
import { messageToJson, TypedNotificationWorker } from '../worker';

export const userFollowNotification: TypedNotificationWorker<'api.v1.user-follow'> =
  {
    subscription: 'api.user-follow-notification',
    handler: async (data, con) => {
      const { referenceUserId, userId } = data.payload;

      const queryBuilder = con.getRepository(User).createQueryBuilder('u');

      const user = await queryBuilder
        .select(['id', 'username', 'name'])
        .where(`${queryBuilder.alias}.id = :userId`, {
          userId,
        })
        .andWhere(
          whereNotUserBlocked(queryBuilder, {
            userId: referenceUserId,
            columnName: 'id',
          }),
        )
        .andWhere(whereVordrFilter(queryBuilder.alias))
        .getRawOne<Pick<User, 'id' | 'username' | 'name'>>();

      if (!user) {
        return;
      }

      return [
        {
          type: NotificationType.UserFollow,
          ctx: {
            user,
            userIds: [referenceUserId],
          },
        },
      ];
    },
    parseMessage(message) {
      // TODO: Clean this once we move all workers to TypedWorkers
      return messageToJson(message);
    },
  };
