import { messageToJson } from '../worker';
import { Post } from '../../entity';
import { NotificationPostContext } from '../../notifications';
import { NotificationWorker } from './worker';

interface Data {
  postId: string;
  authorId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.article-picked-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const post = await con
      .getRepository(Post)
      .findOne({ where: { id: data.postId } });
    const ctx: NotificationPostContext = {
      userId: data.authorId,
      post,
    };
    return [{ type: 'article_picked', ctx }];
  },
};

export default worker;
