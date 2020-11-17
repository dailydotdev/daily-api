import { messageToJson, Worker } from './worker';
import { redisPubSub } from '../redis';

interface Data {
  userId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-upvoted-redis',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await redisPubSub.publish('events.posts.upvoted', data);
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to send post upvoted event to redis',
      );
      throw err;
    }
  },
};

export default worker;
