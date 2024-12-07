import { messageToJson } from '../worker';
import { NotificationWorker } from './worker';
import { buildPostContext, uniquePostOwners } from './utils';
import { NotificationType } from '../../notifications/common';
import { queryReadReplica } from '../../common/queryReadReplica';

interface Data {
  postId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.article-analytics-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const ctx = await queryReadReplica(con, ({ queryRunner }) => {
      return buildPostContext(queryRunner.manager, data.postId);
    });

    if (!ctx) {
      return;
    }
    const users = uniquePostOwners(ctx.post);
    if (!users.length) {
      return;
    }
    return [
      {
        type: NotificationType.ArticleAnalytics,
        ctx: { ...ctx, userIds: users },
      },
    ];
  },
};

export default worker;
