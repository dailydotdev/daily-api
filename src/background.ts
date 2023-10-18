import {
  addPubsubSpanLabels,
  runInRootSpan,
  runInSpan,
} from './telemetry/opentelemetry';
import { SpanKind } from '@opentelemetry/api';
import 'reflect-metadata';
import { PubSub, Message } from '@google-cloud/pubsub';
import pino from 'pino';

import './config';

import { workers } from './workers';
import { DataSource } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import createOrGetConnection from './db';

const subscribe = (
  logger: pino.Logger,
  pubsub: PubSub,
  connection: DataSource,
  subscription: string,
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
  sub.on('message', async (message) =>
    runInRootSpan(
      `message: ${subscription}`,
      async (span) => {
        addPubsubSpanLabels(span, subscription, message);
        try {
          await runInSpan('handler', async () =>
            handler(message, connection, childLogger, pubsub),
          );
          message.ack();
        } catch (err) {
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

  logger.info('background processing in on');

  workers.forEach((worker) =>
    subscribe(
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
}
