import { FastifyLoggerInstance } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';
import { DataSource } from 'typeorm';

export interface Cron {
  name: string;
  handler: (
    con: DataSource,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
  ) => Promise<void>;
}
