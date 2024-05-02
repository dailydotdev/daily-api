import { updateUserContactLists } from '../common';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.user-created'> = {
  subscription: 'api.add-to-mailing-list',
  handler: async (message, con, log) => {
    if (process.env.NODE_ENV === 'development') return;

    const {
      data: { user },
    } = message;
    if (user.infoConfirmed && user.email) {
      await updateUserContactLists(log, user);
    }
  },
};

export default worker;
