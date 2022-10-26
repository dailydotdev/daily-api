import 'reflect-metadata';
import { PubSub, Message } from '@google-cloud/pubsub';
import pino from 'pino';

import './config';

import { createOrGetConnection } from './db';
import { workers } from './workers';
import { Connection } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';

const subscribe = (
  logger: pino.Logger,
  pubsub: PubSub,
  connection: Connection,
  subscription: string,
  handler: (
    message: Message,
    con: Connection,
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
  sub.on('message', async (message) => {
    try {
      await handler(message, connection, childLogger, pubsub);
      message.ack();
    } catch (err) {
      childLogger.error(
        { messageId: message.id, data: message.data.toString('utf-8'), err },
        'failed to process message',
      );
      message.nack();
    }
  });
};

export default async function app(): Promise<void> {
  const logger = pino();
  const connection = await createOrGetConnection();
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
