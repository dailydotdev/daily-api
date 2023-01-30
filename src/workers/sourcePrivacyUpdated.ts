import { messageToJson, Worker } from './worker';
import { Post } from '../entity';

interface Data {
  sourceId: string;
  privacy: boolean;
}

const worker: Worker = {
  subscription: 'source-privacy-updated-api',
  handler: async (message, con, logger): Promise<void> => {
    const { sourceId, privacy }: Data = messageToJson(message);
    try {
      await con.getRepository(Post).update(
        {
          sourceId,
        },
        {
          private: privacy,
        },
      );
      logger.info(
        {
          sourceId,
          messageId: message.messageId,
        },
        'updated source posts privacy',
      );
    } catch (err) {
      logger.error(
        {
          sourceId,
          messageId: message.messageId,
          err,
        },
        'failed to trigger updating source privacy',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
