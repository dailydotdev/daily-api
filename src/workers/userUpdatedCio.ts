import { ghostUser, resubscribeUser } from '../common';
import { TypedWorker } from './worker';
import { cio, identifyUser } from '../cio';

const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-cio',
  handler: async (message, con, log) => {
    try {
      if (!process.env.CIO_SITE_ID) {
        return;
      }

      const {
        data: { newProfile: user, user: oldUser },
      } = message;

      if (
        user.id === ghostUser.id ||
        !user.infoConfirmed ||
        !user.emailConfirmed
      ) {
        return;
      }

      if (
        (user.notificationEmail && !oldUser.notificationEmail) ||
        (user.acceptedMarketing && !oldUser.acceptedMarketing)
      ) {
        await resubscribeUser(cio, user.id);
      }

      await identifyUser({
        con,
        cio,
        user,
      });
      log.info({ userId: user.id }, 'updated user profile in customerio');
    } catch (_err) {
      const err = _err as Error;
      log.error({ err }, 'failed to update user profile in customerio');
    }
  },
};

export default worker;
