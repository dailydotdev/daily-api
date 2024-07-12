import { Bookmark } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { buildPostContext } from './utils';

const worker = generateTypedNotificationWorker({
  subscription: 'api.v1.post-bookmark-reminder',
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

    return [
      {
        type: NotificationType.PostBookmarkReminder,
        ctx: { ...postCtx, userIds: [userId] },
      },
    ];
  },
});

export default worker;
