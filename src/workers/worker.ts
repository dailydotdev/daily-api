import { Connection } from 'typeorm';
import { Logger } from 'fastify';
import { Message, PubSub } from '@google-cloud/pubsub';

const env = process.env.NODE_ENV || 'development';

export const messageToJson = <T>(message: Message): T =>
  JSON.parse(message.data.toString('utf8'));

export const envBasedName = (name: string): string =>
  `${name}${env === 'production' ? '' : `-${env}`}`;

export interface Worker {
  topic: string;
  subscription: string;
  handler: (
    message: Message,
    con: Connection,
    logger: Logger,
    pubsub: PubSub,
  ) => Promise<void>;
}
