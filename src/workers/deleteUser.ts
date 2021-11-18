import { messageToJson, Worker } from './worker';
import { User, View } from '../entity';

interface UserData {
  id: string;
  name: string;
  email: string;
  image: string;
  company?: string;
  title?: string;
  infoConfirmed: boolean;
  username?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  createdAt: Date;
  acceptedMarketing: boolean;
  portfolio?: string;
  hashnode?: string;
  timezone?: string;
}

interface Data {
  user: UserData;
}

const worker: Worker = {
  subscription: 'user-deleted-api',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await con.getRepository(View).delete({ userId: data.user.id });
      await con.getRepository(User).delete(data.user.id);
      logger.info(
        {
          userId: data.user.id,
          messageId: message.messageId,
        },
        'deleted user',
      );
    } catch (err) {
      logger.error(
        {
          userId: data.user.id,
          messageId: message.messageId,
          err,
        },
        'failed to delete user',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
