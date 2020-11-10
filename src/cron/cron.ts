import { Connection } from 'typeorm';
import { Logger } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';

export interface Cron {
  name: string;
  handler: (
    con: Connection,
    logger: Logger,
    pubsub: PubSub,
    data: unknown,
  ) => Promise<void>;
}
