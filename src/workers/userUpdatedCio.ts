import { ghostUser } from '../common';
import { TypedWorker } from './worker';
import { cio, identifyUser } from '../cio';

const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-cio',
  handler: async (message, con, log) => {
    if (!process.env.CIO_SITE_ID) {
      return;
    }

    const {
      data: { newProfile: user },
    } = message;

    if (user.id === ghostUser.id || !user.infoConfirmed) {
      return;
    }

    await identifyUser(cio, user);
    log.info({ userId: user.id }, 'updated user profile in customerio');
  },
};

export default worker;
