import { messageToJson, Worker } from './worker';
import { User } from '../entity';

interface Data {
  id: string;
  name: string;
  email: string;
  image: string;
  referral: string;
  createdAt: Date;
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
        createdAt: data.createdAt,
        email: data.email,
        referral: data.referral,
      });
      logger.info(
        {
          userId: data.id,
          messageId: message.messageId,
        },
        'added new user',
      );
    } catch (err) {
      logger.error(
        {
          userId: data.id,
          messageId: message.messageId,
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
