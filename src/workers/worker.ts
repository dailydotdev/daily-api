import { Connection } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';

export interface Message {
  messageId: string;
  data: Buffer;
}

export const messageToJson = <T>(message: Message): T =>
  JSON.parse(message.data.toString('utf-8').trim());

export interface Worker {
  subscription: string;
  handler: (
    message: Message,
    con: Connection,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
  ) => Promise<void>;
  maxMessages?: number;
}
