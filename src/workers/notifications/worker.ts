import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import {
  Message,
  messageToJson,
  TypedNotificationWorkerProps,
} from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { PubSubSchema } from '../../common';

interface NotificationWorkerResult {
  type: NotificationType;
  ctx: NotificationBaseContext;
}

export type NotificationHandlerReturn = NotificationWorkerResult[] | undefined;

type NotificationMessageHandler = (
  message: Message,
  con: DataSource,
  logger: FastifyBaseLogger,
) => Promise<NotificationHandlerReturn>;

export interface NotificationWorker {
  subscription: string;
  handler: NotificationMessageHandler;
  maxMessages?: number;
}

interface GenerateTypeWorkerResult {
  subscription: string;
  handler: NotificationMessageHandler;
}

export const generateTypedNotificationWorker = <
  T extends keyof PubSubSchema,
  D extends PubSubSchema[T] = PubSubSchema[T],
>({
  subscription,
  handler,
}: TypedNotificationWorkerProps<T>): GenerateTypeWorkerResult => {
  return {
    subscription,
    handler: (message, ...props) => {
      const data: D = messageToJson(message);

      return handler(data, ...props);
    },
  };
};
