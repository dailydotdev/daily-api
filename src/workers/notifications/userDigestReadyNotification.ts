import { User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { buildPostContext } from './utils';
import { TypedNotificationWorker } from '../worker';

export const userDigestReadyNotification: TypedNotificationWorker<'api.v1.digest-ready'> =
  {
    subscription: 'api.user-digest-ready-notification',
    handler: async (data, con) => {
      const { postId, userId, sendAtMs } = data;

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
          type: NotificationType.DigestReady,
          ctx: {
            ...postCtx,
            userIds: [user.id],
            sendAtMs,
          },
        },
      ];
    },
  };
