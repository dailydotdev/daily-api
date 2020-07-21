import { envBasedName, messageToJson, Worker } from './worker';
import { User } from '../entity';

interface UserData {
  id: string;
  name: string;
  email: string;
  image: string;
  company: string;
  title: string;
  infoConfirmed: boolean;
  premium: boolean;
}

interface ProfileData {
  name: string;
  email: string;
  company: string;
  title: string;
  infoConfirmed: boolean;
}

interface Data {
  user: UserData;
  newProfile: ProfileData;
}

const worker: Worker = {
  topic: 'user-updated',
  subscription: envBasedName('user-updated-api'),
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await con.getRepository(User).update(
        { id: data.user.id },
        {
          name: data.newProfile.name,
        },
      );
      logger.info(
        {
          userId: data.user.id,
          messageId: message.id,
        },
        'updated user',
      );
      message.ack();
    } catch (err) {
      logger.error(
        {
          userId: data.user.id,
          messageId: message.id,
          err,
        },
        'failed to update user',
      );
      if (err.name === 'QueryFailedError') {
        message.ack();
      } else {
        message.nack();
      }
    }
  },
};

export default worker;
