import { messageToJson, Worker } from './worker';
import { redisPubSub } from '../redis';
import { getPostNotification } from '../schema/posts';

interface Data {
  userId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-upvoted-redis',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const postNotificatiion = await getPostNotification(con, data.postId);

      if (postNotificatiion) {
        await redisPubSub.publish('events.posts.upvoted', postNotificatiion);
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send post upvoted event to redis',
      );
      throw err;
    }
  },
};

export default worker;
