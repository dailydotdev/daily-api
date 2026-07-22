import { NotificationType } from '../../notifications/common';
import { TypedNotificationWorker } from '../worker';
import type { NotificationHandlerReturn } from './worker';
import type { NotificationStreakFreezeContext } from '../../notifications';

const worker: TypedNotificationWorker<'api.v1.user-streak-updated'> = {
  subscription: 'api.streak-freeze-used-notification',
  handler: async ({ streak, freeze }) => {
    if (!freeze) {
      return;
    }

    const ctx: NotificationStreakFreezeContext = {
      userIds: [streak.userId],
      streak,
      freeze,
    };

    const notifications: NonNullable<NotificationHandlerReturn> = [
      { type: NotificationType.StreakFreezeUsed, ctx },
    ];

    if (freeze.remainingFreezes === 0) {
      notifications.push({ type: NotificationType.StreakFreezeDepleted, ctx });
    }

    return notifications;
  },
};

export default worker;
