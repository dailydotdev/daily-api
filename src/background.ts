import { runInRootSpan, opentelemetry } from './telemetry';
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
  const meter = opentelemetry.metrics.getMeter('api-bg');

  loadAuthKeys();
  await loadFeatures(logger);

  logger.info('background processing in on');

  workers.forEach((worker) =>
    workerSubscribe(
      logger,
      pubsub,
      connection,
      worker.subscription,
      meter,
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

  typedWorkers.forEach((worker) =>
    workerSubscribe(
      logger,
      pubsub,
      connection,
      worker.subscription,
      meter,
      (message, con, logger, pubsub) =>
        worker.handler(
          {
            messageId: message.id,
            data: messageToJson(message),
          },
          con,
          logger,
          pubsub,
        ),
    ),
  );
}
