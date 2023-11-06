import { User } from '../common';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { DayOfWeek } from '../types';
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
      preferredDay: DayOfWeek.Wednesday,
      preferredHour: 8,
      preferredTimezone: user.timezone || undefined,
    });
  },
};

export default worker;
