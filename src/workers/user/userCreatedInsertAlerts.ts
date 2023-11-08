import { Alerts, ALERTS_DEFAULT, User } from '../../entity';
import { messageToJson, Worker } from '../worker';

interface Data {
  user: User;
}

const worker: Worker = {
  subscription: 'api.user-created-insert-alerts',
  handler: async (message, con) => {
    const data = messageToJson<Data>(message);
    const { user } = data;

    await con
      .getRepository(Alerts)
      .createQueryBuilder()
      .insert()
      .values({ ...ALERTS_DEFAULT, userId: user.id })
      .orIgnore()
      .execute();
  },
};

export default worker;
