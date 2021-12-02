import { Connection } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';

export interface Cron {
  subscription: string;
  handler: (
    con: Connection,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
    data: Buffer,
  ) => Promise<void>;
}
