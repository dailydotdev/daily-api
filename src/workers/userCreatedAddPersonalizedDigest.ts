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

    if (user.acceptedMarketing) {
      if (user.id) {
        await con.getRepository(UserPersonalizedDigest).save({
          userId: user.id,
          timezone: user.timezone, // TODO WT-1820-personalized-digest timezone can be null
        });
      }
    }
  },
};

export default worker;
