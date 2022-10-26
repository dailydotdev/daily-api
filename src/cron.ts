import 'reflect-metadata';
import { PubSub } from '@google-cloud/pubsub';
import pino from 'pino';

import './config';

import { createOrGetConnection } from './db';
import { crons } from './cron/index';

export default async function app(cronName: string): Promise<void> {
  const logger = pino();
  const connection = await createOrGetConnection();
  const pubsub = new PubSub();

  const selectedCron = crons.find((cron) => cron.name === cronName);
  if (selectedCron) {
    logger.info({ cron: cronName }, 'running cron');
    await selectedCron.handler(connection, logger, pubsub);
  } else {
    logger.warn({ cron: cronName }, 'no such cron');
  }
}
