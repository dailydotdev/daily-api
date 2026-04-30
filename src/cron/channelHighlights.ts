import { triggerTypedEvent } from '../common/typedPubsub';
import { Cron } from './cron';

const cron: Cron = {
  name: 'channel-highlights',
  handler: async (_, logger) => {
    const scheduledAt = new Date().toISOString();

    await triggerTypedEvent(logger, 'api.v1.generate-highlights', {
      scheduledAt,
    });
  },
};

export default cron;
