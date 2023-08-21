import { Worker } from './worker';
import { setRedisObject } from '../redis';
import { REDIS_BANNER_KEY } from '../config';

const worker: Worker = {
  subscription: 'api.banner-deleted',
  handler: async (message, con, logger): Promise<void> => {
    try {
      await setRedisObject(REDIS_BANNER_KEY, 'false');
    } catch (err) {
      logger.error(
        { messageId: message.messageId, err },
        'failed to remove redis cache for banner',
      );
    }
  },
};

export default worker;
