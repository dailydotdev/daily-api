import { messageToJson, Worker } from './worker';
import { User } from '../entity';

interface UserData {
  id: string;
  name: string;
  email: string;
  image: string;
  company?: string;
  title?: string;
  infoConfirmed: boolean;
  premium: boolean;
  username?: string;
  bio?: string;
  twitter?: string;
  github?: string;
}

interface ProfileData {
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
}

interface Data {
  user: UserData;
  newProfile: ProfileData;
}

const worker: Worker = {
  subscription: 'user-updated-api',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await con.getRepository(User).save(
        {
          id: data.user.id,
          name: data.newProfile.name,
          image: data.newProfile.image,
          username: data.newProfile.username,
          twitter: data.newProfile.twitter,
          profileConfirmed: false,
        },
      );
      logger.info(
        {
          userId: data.user.id,
          messageId: message.id,
        },
        'updated user',
      );
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
        return;
      }
      throw err;
    }
  },
};

export default worker;
