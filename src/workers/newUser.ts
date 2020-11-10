import { messageToJson, Worker } from './worker';
import { User } from '../entity';

interface Data {
  id: string;
  name: string;
  email: string;
  image: string;
  referral: string;
}

const worker: Worker = {
  subscription: 'user-registered-api',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await con.getRepository(User).save({
        id: data.id,
        name: data.name,
        image: data.image,
      });
      logger.info(
        {
          userId: data.id,
          messageId: message.id,
        },
        'added new user',
      );
    } catch (err) {
      logger.error(
        {
          userId: data.id,
          messageId: message.id,
          err,
        },
        'failed to add new user',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
