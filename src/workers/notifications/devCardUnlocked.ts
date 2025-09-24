import { TypedNotificationWorker } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';

export const DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD = 20;

export const devCardUnlocked: TypedNotificationWorker<'user-reputation-updated'> =
  {
    subscription: 'api.user-reputation-updated-notification',
    handler: async ({ user, userAfter }) => {
      if (
        user.reputation > DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD ||
        userAfter.reputation < DEFAULT_DEV_CARD_UNLOCKED_THRESHOLD
      ) {
        return;
      }

      const ctx: NotificationBaseContext = {
        userIds: [userAfter.id],
      };

      return [{ type: NotificationType.DevCardUnlocked, ctx }];
    },
  };
