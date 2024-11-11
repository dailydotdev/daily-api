import { generateTypedNotificationWorker } from './worker';
import { NotificationType } from '../../notifications/common';
import { NotificationPostContext } from '../../notifications';
import { buildPostContext } from './utils';
import { SourcePostModerationStatus } from '../../entity/SourcePostModeration';

const worker =
  generateTypedNotificationWorker<'api.v1.source-post-moderation-approved'>({
    subscription: 'api.source-post-moderation-approved-notification',
    handler: async ({ post: data }, con) => {
      if (data.status !== SourcePostModerationStatus.Approved) {
        return;
      }

      if (!data?.postId) {
        return;
      }

      const baseCtx = await buildPostContext(con, data.postId);
      const ctx: NotificationPostContext = {
        ...baseCtx!,
        userIds: [data.createdById],
      };

      return [{ type: NotificationType.SourcePostApproved, ctx }];
    },
  });

export default worker;
