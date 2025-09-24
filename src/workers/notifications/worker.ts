import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';

interface NotificationWorkerResult {
  type: NotificationType;
  ctx: NotificationBaseContext;
}

export type NotificationHandlerReturn = NotificationWorkerResult[] | undefined;
