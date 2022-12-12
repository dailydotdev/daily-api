import { messageToJson } from '../worker';
import { Post } from '../../entity';
import { NotificationPostContext } from '../../notifications';
import { NotificationWorker } from './worker';

interface Data {
  postId: string;
  scoutId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.community-picks-succeeded-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const post = await con
      .getRepository(Post)
      .findOne({ where: { id: data.postId } });
    const ctx: NotificationPostContext = {
      userId: data.scoutId,
      post,
    };
    return [{ type: 'community_picks_succeeded', ctx }];
  },
};

export default worker;
