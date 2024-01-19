import { FastifyLoggerInstance } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';
import { DataSource } from 'typeorm';
import { PubSubSchema } from '../common/typedPubsub';

export interface Message {
  messageId: string;
  data: Buffer;
}

export const messageToJson = <T>(message: Pick<Message, 'data'>): T =>
  JSON.parse(message.data.toString('utf-8').trim());

export interface Worker {
  subscription: string;
  handler: (
    message: Message,
    con: DataSource,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
  ) => Promise<void>;
  maxMessages?: number;
}

export interface TypedMessage<T> {
  messageId: string;
  data: T;
}

export interface BaseTypedWorker<T> {
  subscription: string;
  handler: (
    data: TypedMessage<T>,
    con: DataSource,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
  ) => Promise<void>;
  maxMessages?: number;
}

export interface TypedWorker<T extends keyof PubSubSchema>
  extends BaseTypedWorker<PubSubSchema[T]> {}
