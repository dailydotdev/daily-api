import { runInRootSpan } from '../telemetry';
import 'reflect-metadata';
import { PubSub } from '@google-cloud/pubsub';

import '../config';

import createOrGetConnection from '../db';
import { workerSubscribe } from '../common';
import { personalizedDigestWorkers as workers } from '../workers';
import { loadFeatures } from '../growthbook';
import { logger } from '../logger';
import { loadAuthKeys } from '../auth';

export default async function app(): Promise<void> {
  const connection = await runInRootSpan(
    'createOrGetConnection',
    createOrGetConnection,
  );
  const pubsub = new PubSub();

  loadAuthKeys();
  await loadFeatures(logger);

  logger.info('personalized-digest processing in on');

  workers.forEach((worker) =>
    workerSubscribe(
      logger,
      pubsub,
      connection,
      worker.subscription,
      (message, con, logger, pubsub) =>
        worker.handler(
          {
            messageId: message.id,
            data: message.data,
          },
          con,
          logger,
          pubsub,
        ),
      100,
    ),
  );
}
