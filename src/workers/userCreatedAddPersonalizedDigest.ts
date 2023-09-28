import { User } from '../common';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { messageToJson, Worker } from './worker';

interface Data {
  user: User;
}

const worker: Worker = {
  subscription: 'api.user-created-add-personalized-digest',
  handler: async (message, con) => {
    const data = messageToJson<Data>(message);
    const { user } = data;

    await con.getRepository(UserPersonalizedDigest).save({
      userId: user.id,
      preferredTimezone: user.timezone,
    });
  },
};

export default worker;
