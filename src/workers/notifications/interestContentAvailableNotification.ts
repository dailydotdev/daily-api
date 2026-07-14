import { User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { buildPostContext } from './utils';
import { TypedNotificationWorker } from '../worker';

export const interestContentAvailableNotification: TypedNotificationWorker<'api.v1.interest-content-available'> =
  {
    subscription: 'api.interest-content-available-notification',
    handler: async (data, con) => {
      const { postId, userId } = data;

      const postCtx = await buildPostContext(con, postId);

      if (!postCtx) {
        return;
      }

      const user: Pick<User, 'id'> | null = await con
        .getRepository(User)
        .findOne({
          select: ['id'],
          where: { id: userId },
        });

      if (!user) {
        return;
      }

      return [
        {
          type: NotificationType.InterestContentAvailable,
          ctx: {
            ...postCtx,
            userIds: [user.id],
          },
        },
      ];
    },
  };
