import { messageToJson } from '../worker';
import { Post } from '../../entity';
import { NotificationPostContext } from '../../notifications';
import { NotificationWorker } from './worker';
import { uniquePostOwners } from './utils';

interface Data {
  postId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.article-analytics-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const post = await con
      .getRepository(Post)
      .findOne({ where: { id: data.postId } });
    const users = uniquePostOwners(post);
    if (!users.length) {
      return;
    }
    const ctx: Omit<NotificationPostContext, 'userId'> = { post };
    return users.map((userId) => ({
      type: 'article_analytics',
      ctx: { ...ctx, userId },
    }));
  },
};

export default worker;
