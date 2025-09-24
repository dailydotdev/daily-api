import { TypedNotificationWorker } from '../worker';
import { NotificationSubmissionContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';

export const communityPicksFailed: TypedNotificationWorker<'community-link-rejected'> =
  {
    subscription: 'api.community-picks-failed-notification',
    handler: async (submission) => {
      const ctx: NotificationSubmissionContext = {
        userIds: [submission.userId],
        submission,
      };
      return [{ type: NotificationType.CommunityPicksFailed, ctx }];
    },
  };
