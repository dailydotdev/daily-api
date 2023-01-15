import { updateUserContactLists, User } from '../common';
import { messageToJson, Worker } from './worker';

interface Data {
  user: User;
}

const worker: Worker = {
  subscription: 'api.add-to-mailing-list',
  handler: async (message, con, log) => {
    const data = messageToJson<Data>(message);
    const { user } = data;
    if (user.infoConfirmed && user.email) {
      await updateUserContactLists(log, user);
    }
  },
};

export default worker;
