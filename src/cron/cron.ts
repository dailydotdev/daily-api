import { Connection } from 'typeorm';
import { Logger } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';

export interface Cron {
  subscription: string;
  handler: (
    con: Connection,
    logger: Logger,
    pubsub: PubSub,
    data: Buffer,
  ) => Promise<void>;
}
