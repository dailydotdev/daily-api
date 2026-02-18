import 'reflect-metadata';
import { PubSub } from '@google-cloud/pubsub';

import './config';

import { crons } from './cron/index';
import createOrGetConnection from './db';
import { logger } from './logger';
import { runInRootSpan } from './telemetry';

export default async function app(cronName: string): Promise<void> {
  const connection = await createOrGetConnection();
  const pubsub = new PubSub();

  const selectedCron = crons.find((cron) => cron.name === cronName);
  if (selectedCron) {
    logger.info({ cron: cronName }, 'running cron');
    await runInRootSpan(`cron: ${cronName}`, async () => {
      await selectedCron.handler(connection, logger, pubsub);
    });
  } else {
    logger.warn({ cron: cronName }, 'no such cron');
  }
}
