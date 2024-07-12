import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { Message, messageToJson } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { PubSubSchema } from '../../common';

export type NotificationHandlerReturn =
  | {
      type: NotificationType;
      ctx: NotificationBaseContext;
    }[]
  | undefined;

export type NotificationWorkerHandler = (
  message: Message,
  con: DataSource,
  logger: FastifyBaseLogger,
) => Promise<NotificationHandlerReturn>;

export interface NotificationWorker {
  subscription: string;
  handler: NotificationWorkerHandler;
  maxMessages?: number;
}

interface TypedNotificationWorkerProps<
  T extends keyof PubSubSchema,
  D extends PubSubSchema[T] = PubSubSchema[T],
> {
  subscription: string;
  handler: (
    data: D,
    con: DataSource,
    logger: FastifyBaseLogger,
  ) => Promise<NotificationHandlerReturn>;
}

interface GenerateTypeWorkerResult {
  subscription: string;
  handler: NotificationWorkerHandler;
}

export const generateTypedNotificationWorker = <
  T extends keyof PubSubSchema,
  D extends PubSubSchema[T] = PubSubSchema[T],
>({
  subscription,
  handler,
}: TypedNotificationWorkerProps<T, D>): GenerateTypeWorkerResult => {
  return {
    subscription,
    handler: (message, ...props) => {
      const data: D = messageToJson(message);

      return handler(data, ...props);
    },
  };
};
