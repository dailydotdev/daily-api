import { TypedWorker } from './worker';
import { cio } from '../cio';

const worker: TypedWorker<'user-deleted'> = {
  subscription: 'api.user-deleted-cio',
  handler: async (message, _, log) => {
    await cio.destroy(message.data.id);
    log.info({ userId: message.data.id }, 'deleted user from customerio');
  },
};

export default worker;
