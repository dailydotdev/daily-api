import { Connection } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';

export interface Cron {
  name: string;
  handler: (
    con: Connection,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
  ) => Promise<void>;
}
