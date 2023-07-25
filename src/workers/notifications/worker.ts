import { DataSource } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import { Message } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';

export type NotificationHandlerReturn = {
  type: NotificationType;
  ctx: NotificationBaseContext;
}[];

export interface NotificationWorker {
  subscription: string;
  handler: (
    message: Message,
    con: DataSource,
    logger: FastifyLoggerInstance,
  ) => Promise<NotificationHandlerReturn>;
  maxMessages?: number;
}
