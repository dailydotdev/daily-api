import { messageToJson, Worker } from './worker';
import { redisPubSub } from '../redis';

interface Data {
  userId: string;
  commentId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-commented-redis',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await redisPubSub.publish('events.posts.commented', data);
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send post commented event to redis',
      );
      throw err;
    }
  },
};

export default worker;
