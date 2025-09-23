import { PollPost } from '../../entity/posts/PollPost';
import { UserPost } from '../../entity/user/UserPost';
import { NotificationType } from '../../notifications/common';
import type { NotificationPostContext } from '../../notifications';
import { messageToJson, TypedNotificationWorker } from '../worker';
import { buildPostContext } from './utils';
import { IsNull, Not } from 'typeorm';

export const pollResultNotification: TypedNotificationWorker<'api.v1.delayed-notification-reminder'> =
  {
    subscription: 'api.poll-result-notification',
    handler: async (data, con) => {
      if (
        data.entityTableName !== con.getRepository(PollPost).metadata.tableName
      ) {
        return;
      }

      const poll = await con.getRepository(PollPost).findOne({
        where: { id: data.entityId },
        select: ['id', 'authorId'],
      });

      if (!poll?.authorId) {
        return;
      }

      const userPosts = await con.getRepository(UserPost).find({
        where: {
          postId: poll.id,
          pollVoteOptionId: Not(IsNull()),
          userId: Not(poll.authorId),
        },
        select: ['userId'],
      });

      if (!userPosts.length) {
        return;
      }

      const postCtx = await buildPostContext(con, poll.id);
      if (!postCtx) {
        return;
      }

      const notificationCtx: NotificationPostContext = {
        ...postCtx,
        userIds: userPosts.map((up) => up.userId),
      };

      return [
        {
          type: NotificationType.PollResult,
          ctx: notificationCtx,
        },
      ];
    },
    parseMessage(message) {
      // TODO: Clean this once we move all workers to TypedWorkers
      return messageToJson(message);
    },
  };
