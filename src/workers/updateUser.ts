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
  newProfile: UserData;
}

const worker: Worker = {
  subscription: 'user-updated-api',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await con.getRepository(User).save({
        id: data.user.id,
        name: data.newProfile.name,
        image: data.newProfile.image,
        username: data.newProfile.username,
        twitter: data.newProfile.twitter,
        profileConfirmed: false,
        createdAt: data.user.createdAt,
        email: data.newProfile.email,
        company: data.newProfile.company,
        acceptedMarketing: data.newProfile.acceptedMarketing,
        bio: data.newProfile.bio,
        infoConfirmed: data.newProfile.infoConfirmed,
        portfolio: data.newProfile.portfolio,
        github: data.newProfile.github,
        title: data.newProfile.title,
        hashnode: data.newProfile.hashnode,
        timezone: data.newProfile.timezone,
        updatedAt: new Date(),
      });
      logger.info(
        {
          userId: data.user.id,
          messageId: message.messageId,
        },
        'updated user',
      );
    } catch (err) {
      logger.error(
        {
          userId: data.user.id,
          messageId: message.messageId,
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
