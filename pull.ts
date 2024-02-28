import { PubSub } from '@google-cloud/pubsub';
import { logger } from './src/logger';
import './src/config';
import worker from './src/workers/cdc/primary';
import createOrGetConnection from './src/db';

(async () => {
  const pubsub = new PubSub();
  const con = await createOrGetConnection();
  const sub = pubsub.subscription('api-cdc', {
    flowControl: {
      maxMessages: 20,
    },
  });
  sub.on('message', async (message) => {
    try {
      logger.info(
        {
          msgId: message.id,
          orderingKey: message.orderingKey,
          publishTime: message.publishTime,
        },
        'received message',
      );
      await worker.handler(message, con, logger, pubsub);
      message.ack();
    } catch (err) {
      logger.error(err);
      message.nack();
    }
  });
})();
