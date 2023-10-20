import {
  addPubsubSpanLabels,
  runInRootSpan,
  runInSpan,
} from './telemetry/opentelemetry';
import { SpanKind } from '@opentelemetry/api';
import 'reflect-metadata';
import { PubSub, Message } from '@google-cloud/pubsub';
import pino from 'pino';
import { performance } from 'perf_hooks';

import './config';

import { workers } from './workers';
import { DataSource } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import createOrGetConnection from './db';
import { api } from '@opentelemetry/sdk-node';

const subscribe = (
  logger: pino.Logger,
  pubsub: PubSub,
  connection: DataSource,
  subscription: string,
  meter: api.Meter,
  handler: (
    message: Message,
    con: DataSource,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
  ) => Promise<void>,
  maxMessages = 1,
): void => {
  logger.info(`subscribing to ${subscription}`);
  const sub = pubsub.subscription(subscription, {
    flowControl: {
      maxMessages,
    },
    batching: { maxMilliseconds: 10 },
  });
  const childLogger = logger.child({ subscription });
  const histogram = meter.createHistogram('message_processing_time', {
    unit: 'ms',
    description: 'time to process a message',
  });
  sub.on('message', async (message) =>
    runInRootSpan(
      `message: ${subscription}`,
      async (span) => {
        const startTime = performance.now();
        let success = true;
        addPubsubSpanLabels(span, subscription, message);
        try {
          await runInSpan('handler', async () =>
            handler(message, connection, childLogger, pubsub),
          );
          message.ack();
        } catch (err) {
          success = false;
          childLogger.error(
            {
              messageId: message.id,
              data: message.data.toString('utf-8'),
              err,
            },
            'failed to process message',
          );
          message.nack();
        }
        histogram.record(performance.now() - startTime, {
          subscription,
          success,
        });
      },
      {
        kind: SpanKind.CONSUMER,
      },
    ),
  );
};

export default async function app(): Promise<void> {
  const logger = pino();
  const connection = await runInRootSpan(
    'createOrGetConnection',
    createOrGetConnection,
  );
  const pubsub = new PubSub();
  const meter = api.metrics.getMeter('api-bg');

  logger.info('background processing in on');

  workers.forEach((worker) =>
    subscribe(
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
