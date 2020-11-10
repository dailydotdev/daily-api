import { Connection } from 'typeorm';
import { Logger } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';

export interface Message {
  id: string;
  data: string;
}

export const messageToJson = <T>(message: Message): T =>
  JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8').trim());

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
