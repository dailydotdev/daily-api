import { generateTypedNotificationWorker } from './worker';
import { NotificationType } from '../../notifications/common';
import { NotificationPostContext } from '../../notifications';
import { buildPostContext } from './utils';

const worker =
  generateTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>({
    subscription: 'api.v1.source-post-moderation-submitted-notification',
    handler: async ({ post: data }, con) => {
      if (!data?.postId) {
        return;
      }

      if (!data?.createdById) {
        return;
      }

      const baseCtx = await buildPostContext(con, data.postId);
      const ctx: NotificationPostContext = {
        ...baseCtx!,
        userIds: [data.createdById],
      };

      return [{ type: NotificationType.SquadPostApproved, ctx }];
    },
  });

export default worker;
