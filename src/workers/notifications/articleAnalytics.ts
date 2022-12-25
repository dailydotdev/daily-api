import { messageToJson } from '../worker';
import { NotificationWorker } from './worker';
import { buildPostContext, uniquePostOwners } from './utils';

interface Data {
  postId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.article-analytics-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const ctx = await buildPostContext(con, data.postId);
    if (!ctx) {
      return;
    }
    const users = uniquePostOwners(ctx.post);
    if (!users.length) {
      return;
    }
    return users.map((userId) => ({
      type: 'article_analytics',
      ctx: { ...ctx, userId },
    }));
  },
};

export default worker;
