import { ghostUser } from '../common';
import { TypedWorker } from './worker';
import { cio, identifyUser } from '../cio';

const worker: TypedWorker<'api.v1.user-created'> = {
  subscription: 'api.user-created-cio',
  handler: async (message, con, log) => {
    const {
      data: { user },
    } = message;

    if (user.id === ghostUser.id || !user.infoConfirmed) {
      return;
    }

    await identifyUser(cio, user);
    log.info({ userId: user.id }, 'created user profile in customerio');
  },
};

export default worker;
