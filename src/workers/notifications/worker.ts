import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { Message } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';

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

export interface NotificationWorker<T = object> {
  subscription: string;
  handler: NotificationMessageHandler;
  maxMessages?: number;
  parseMessage?: (message: Message) => T;
}
