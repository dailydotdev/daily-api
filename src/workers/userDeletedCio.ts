import { TypedWorker } from './worker';
import { cio } from '../cio';

const worker: TypedWorker<'user-deleted'> = {
  subscription: 'api.user-deleted-cio',
  handler: async (message, _, log) => {
    if (!process.env.CIO_SITE_ID) {
      return;
    }

    await cio.destroy(message.data.id);
    log.info({ userId: message.data.id }, 'deleted user from customerio');
  },
};

export default worker;
