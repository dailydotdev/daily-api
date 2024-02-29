import { runInRootSpan, opentelemetry } from '../telemetry/opentelemetry';
import 'reflect-metadata';
import { PubSub } from '@google-cloud/pubsub';

import '../config';

import createOrGetConnection from '../db';
import { workerSubscribe } from '../common';
import { personalizedDigestWorkers as workers } from '../workers';
import { loadFeatures } from '../growthbook';
import { logger } from '../logger';

export default async function app(): Promise<void> {
  const connection = await runInRootSpan(
    'createOrGetConnection',
    createOrGetConnection,
  );
  const pubsub = new PubSub();
  const meter = opentelemetry.metrics.getMeter('api-personalized-digest');

  await loadFeatures(logger);

  logger.info('personalized-digest processing in on');

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
}
