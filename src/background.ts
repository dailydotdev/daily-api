import { runInRootSpan, opentelemetry } from './telemetry/opentelemetry';
import 'reflect-metadata';
import { PubSub } from '@google-cloud/pubsub';
import pino from 'pino';

import './config';

import { workers } from './workers';
import createOrGetConnection from './db';
import { workerSubscribe } from './common';

export default async function app(): Promise<void> {
  const logger = pino({
    messageKey: 'message',
  });
  const connection = await runInRootSpan(
    'createOrGetConnection',
    createOrGetConnection,
  );
  const pubsub = new PubSub();
  const meter = opentelemetry.metrics.getMeter('api-bg');

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
}
