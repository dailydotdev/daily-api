import '../src/config';
import * as fastify from 'fastify';
import { PubSub } from '@google-cloud/pubsub';
import { newViewWorker } from '../src/workers';
import { stringifyHealthCheck } from '../src';
import { createOrGetConnection } from '../src/db';

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
  await newViewWorker(pubsub, con, app.log);

  await app.listen(parseInt(process.env.PORT) || 3000, '0.0.0.0');
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
