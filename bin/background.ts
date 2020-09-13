import '../src/config';
import fastify from 'fastify';
import { Message, PubSub } from '@google-cloud/pubsub';
import { stringifyHealthCheck } from '../src/common';
import { createOrGetConnection } from '../src/db';
import { Worker, workers } from '../src/workers';
import { Connection } from 'typeorm';
import { Logger } from 'fastify';

const initializeWorker = async (
  pubsub: PubSub,
  worker: Worker,
  con: Connection,
  logger: Logger,
): Promise<void> => {
  const topic = pubsub.topic(worker.topic);
  const subscription = topic.subscription(worker.subscription);
  if (subscription.get) {
    await subscription.get({ autoCreate: true });
  }
  logger.info(`waiting for messages in ${topic.name}`);
  subscription.on(
    'message',
    (message: Message): Promise<void> =>
      worker.handler(message, con, logger, pubsub),
  );
};

// TODO: must add integration tests with google pub/sub
const start = async (): Promise<void> => {
  const app = fastify({
    logger: true,
    disableRequestLogging: true,
  });

  app.get('/health', (req, res) => {
    res.type('application/health+json');
    res.send(stringifyHealthCheck({ status: 'ok' }));
  });

  app.log.info('booting background processor');

  const con = await createOrGetConnection();

  const pubsub = new PubSub();
  await Promise.all(
    workers.map(
      (worker): Promise<void> => initializeWorker(pubsub, worker, con, app.log),
    ),
  );

  await app.listen(parseInt(process.env.PORT) || 3000, '0.0.0.0');
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
