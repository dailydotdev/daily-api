import { FastifyLoggerInstance } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';
import { DataSource } from 'typeorm';
import { PubSubSchema } from '../common/typedPubsub';
import { ExperimentAllocationClient } from '../growthbook';

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

export interface ExperimentWorker extends Worker {
  subscription: string;
  handler: (
    message: Message,
    con: DataSource,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
    experimentAllocationClient?: ExperimentAllocationClient,
  ) => Promise<void>;
  maxMessages?: number;
}

export const workerToExperimentWorker = (
  worker: ExperimentWorker,
): ExperimentWorker => {
  return {
    ...worker,
    handler: async (message, con, logger, pubsub) => {
      const experimentAllocationClient = new ExperimentAllocationClient();

      await (worker as ExperimentWorker).handler(
        message,
        con,
        logger,
        pubsub,
        experimentAllocationClient,
      );

      await experimentAllocationClient.waitForSend();
    },
  };
};
