import { runInRootSpan } from '../telemetry';
import 'reflect-metadata';
import { PubSub } from '@google-cloud/pubsub';

import '../config';

import createOrGetConnection from '../db';
import { workerSubscribe } from '../common';
import { workerJobWorkers as workers } from '../workers';
import { messageToJson } from '../workers/worker';
import { loadFeatures } from '../growthbook';
import { logger } from '../logger';
import { loadAuthKeys } from '../auth';

const WORKER_JOB_MAX_MESSAGES = 5;

export default async function app(): Promise<void> {
  const connection = await runInRootSpan(
    'createOrGetConnection',
    createOrGetConnection,
  );
  const pubsub = new PubSub();

  loadAuthKeys();
  await loadFeatures(logger);

  logger.info('worker-job processing is on');

  workers.forEach((worker) =>
    workerSubscribe(
      logger,
      pubsub,
      connection,
      worker.subscription,
      (message, con, logger, pubsub) => {
        const messageParser = worker.parseMessage ?? messageToJson;

        return worker.handler(
          {
            messageId: message.id,
            data: messageParser(message),
          },
          con,
          logger,
          pubsub,
        );
      },
      worker.maxMessages ?? WORKER_JOB_MAX_MESSAGES,
    ),
  );
}
