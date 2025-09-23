import { User } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { buildPostContext } from './utils';
import { TypedNotificationWorker } from '../worker';

export const userBriefReadyNotification: TypedNotificationWorker<'api.v1.brief-ready'> =
  {
    subscription: 'api.user-brief-ready-notification',
    handler: async (data, con) => {
      const { postId, sendAtMs } = data;

      const postCtx = await buildPostContext(con, postId);

      if (!postCtx) {
        return;
      }

      const user: Pick<User, 'id'> | null = await con
        .getRepository(User)
        .findOne({
          select: ['id'],
          where: { id: data.payload.userId },
        });

      if (!user) {
        return;
      }

      return [
        {
          type: NotificationType.BriefingReady,
          ctx: {
            ...postCtx,
            userIds: [user.id],
            sendAtMs,
          },
        },
      ];
    },
  };
