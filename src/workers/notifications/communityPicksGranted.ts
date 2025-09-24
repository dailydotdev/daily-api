import { TypedNotificationWorker } from '../worker';
import { NotificationBaseContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';

export const communityPicksGranted: TypedNotificationWorker<'community-link-access'> =
  {
    subscription: 'api.community-picks-granted-notification',
    handler: async ({ userId }) => {
      const ctx: NotificationBaseContext = {
        userIds: [userId],
      };
      return [{ type: NotificationType.CommunityPicksGranted, ctx }];
    },
  };
