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

export interface NotificationWorker<T> {
  subscription: string;
  handler: NotificationMessageHandler;
  maxMessages?: number;
  parseMessage: (message: Message) => T;
}

interface GenerateTypeWorkerResult {
  subscription: string;
  handler: NotificationMessageHandler;
}

export const generateTypedNotificationWorker = <T extends keyof PubSubSchema>({
  subscription,
  handler,
  parseMessage,
}: TypedNotificationWorkerProps<T>): GenerateTypeWorkerResult => {
  return {
    subscription,
    handler: (message, ...props) => {
      const parser = parseMessage || messageToJson<T>;
      const data = parser(message) as PubSubSchema[T];

      return handler(data, ...props);
    },
  };
};
