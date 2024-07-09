import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { Message } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';

export type NotificationHandlerReturn =
  | {
      type: NotificationType;
      ctx: NotificationBaseContext;
    }[]
  | undefined;

export interface NotificationWorker {
  subscription: string;
  handler: (
    message: Message,
    con: DataSource,
    logger: FastifyBaseLogger,
  ) => Promise<NotificationHandlerReturn>;
  maxMessages?: number;
}
