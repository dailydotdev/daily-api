import { User } from '../common';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { messageToJson, Worker } from './worker';

interface Data {
  user: User;
  newProfile: User;
}

const worker: Worker = {
  subscription: 'api.user-updated-toggle-personalized-digest',
  handler: async (message, con) => {
    const data = messageToJson<Data>(message);
    const { user, newProfile } = data;

    if (!user.acceptedMarketing && newProfile.acceptedMarketing) {
      await con.getRepository(UserPersonalizedDigest).save({
        userId: newProfile.id,
        timezone: newProfile.timezone, // TODO WT-1820-personalized-digest timezone can be null
      });
    } else if (user.acceptedMarketing && !newProfile.acceptedMarketing) {
      if (newProfile.id) {
        await con.getRepository(UserPersonalizedDigest).delete({
          userId: newProfile.id,
        });
      }
    }
  },
};

export default worker;
