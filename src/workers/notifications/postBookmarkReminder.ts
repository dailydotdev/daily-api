import { messageToJson } from '../worker';
import { Bookmark } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { buildPostContext } from './utils';

interface Data {
  postId: string;
  userId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.post-bookmark-reminder-notification',
  handler: async (message, con) => {
    const { postId, userId }: Data = messageToJson(message);
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
};

export default worker;
