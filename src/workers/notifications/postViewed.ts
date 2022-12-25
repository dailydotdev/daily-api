import { messageToJson } from '../worker';
import {
  NotificationDoneByContext,
  NotificationSourceContext,
} from '../../notifications';
import { NotificationWorker } from './worker';
import { User, View } from '../../entity';
import { DeepPartial } from 'typeorm';
import { buildPostContext } from './utils';

type Data = DeepPartial<View>;

const worker: NotificationWorker = {
  subscription: 'api.post-viewed-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const postCtx = await buildPostContext(con, data.postId);
    if (!postCtx) {
      return;
    }
    if (postCtx.source.type !== 'squad' || !postCtx.post.authorId) {
      return;
    }
    const doneBy = await con.getRepository(User).findOneBy({ id: data.userId });
    if (!doneBy) {
      return;
    }
    const ctx: NotificationSourceContext & NotificationDoneByContext = {
      ...postCtx,
      userId: postCtx.post.authorId,
      doneBy,
    };
    return [{ type: 'post_viewed', ctx }];
  },
};

export default worker;
