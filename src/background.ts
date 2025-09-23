import { runInRootSpan } from './telemetry';
import 'reflect-metadata';
import { PubSub } from '@google-cloud/pubsub';

import './config';

import { typedWorkers, workers } from './workers';
import createOrGetConnection from './db';
import { workerSubscribe } from './common';
import { messageToJson } from './workers/worker';
import { loadFeatures } from './growthbook';
import { logger } from './logger';
import { loadAuthKeys } from './auth';

export default async function app(): Promise<void> {
  const connection = await runInRootSpan(
    'createOrGetConnection',
    createOrGetConnection,
  );
  const pubsub = new PubSub();

  loadAuthKeys();
  await loadFeatures(logger);

  logger.info('background processing in on');

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
    ),
  );

  const typedPubsub = new PubSub();

  typedWorkers.forEach((worker) =>
    workerSubscribe(
      logger,
      typedPubsub,
      connection,
      worker.subscription,
      (message, con, logger, pubsub) => {
        const messageParser = worker.parseMessage ?? messageToJson;

        return worker.handler(
          {
            messageId: message.id,
            data: messageParser(message),
          },
          con,
          logger,
          pubsub,
        );
      },
    ),
  );
}
