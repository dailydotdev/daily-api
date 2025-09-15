import { Bookmark } from '../../entity';
import { NotificationType } from '../../notifications/common';
import { buildPostContext } from './utils';
import {
  NotificationBookmarkContext,
  NotificationPostContext,
} from '../../notifications';
import { queryReadReplica } from '../../common/queryReadReplica';
import { messageToJson, TypedNotificationWorker } from '../worker';

const worker: TypedNotificationWorker<'api.v1.post-bookmark-reminder'> = {
  subscription: 'api.post-bookmark-reminder-notification',
  handler: async ({ postId, userId }, con) => {
    const postCtx = await queryReadReplica(con, ({ queryRunner }) => {
      return buildPostContext(queryRunner.manager, postId);
    });

    if (!postCtx) {
      return;
    }

    const bookmark = await queryReadReplica(con, ({ queryRunner }) => {
      return queryRunner.manager
        .getRepository(Bookmark)
        .findOneBy({ postId, userId });
    });

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
  parseMessage(message) {
    // TODO: Clean this once we move all workers to TypedWorkers
    return messageToJson(message);
  },
};

export default worker;
