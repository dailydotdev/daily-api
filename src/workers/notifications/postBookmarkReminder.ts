import { Bookmark } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { buildPostContext } from './utils';
import {
  NotificationBookmarkContext,
  NotificationPostContext,
} from '../../notifications';

const worker = generateTypedNotificationWorker<'api.v1.post-bookmark-reminder'>(
  {
    subscription: 'api.post-bookmark-reminder-notification',
    handler: async ({ postId, userId }, con) => {
      const postCtx = await buildPostContext(con, postId);

      if (!postCtx) {
        return;
      }

      const bookmark = await con
        .getRepository(Bookmark)
        .findOneBy({ postId, userId });

      if (!bookmark?.remindAt) {
        return;
      }

      const ctx: NotificationPostContext & NotificationBookmarkContext = {
        ...postCtx,
        bookmark,
        userIds: [userId],
      };

      return [{ type: NotificationType.PostBookmarkReminder, ctx }];
    },
  },
);

export default worker;
