import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { setRedisObject } from '../redis';
import { REDIS_BANNER_KEY } from '../config';
import { Banner } from '../entity';

interface Data {
  banner: ChangeObject<Banner>;
}

const worker: Worker = {
  subscription: 'api.banner-added',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { banner } = data;

    try {
      const timestampMs = banner.timestamp / 1000; // createdAt comes as μs here

      await setRedisObject(
        REDIS_BANNER_KEY,
        new Date(timestampMs).toISOString(),
      );
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to set redis cache for banner',
      );
    }
  },
};

export default worker;
