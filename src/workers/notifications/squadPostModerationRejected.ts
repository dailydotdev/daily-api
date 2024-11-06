import { generateTypedNotificationWorker } from './worker';
import { NotificationType } from '../../notifications/common';
import { NotificationPostModerationContext } from '../../notifications';
import { SquadPostModerationStatus } from '../../entity/SquadPostModeration';
import { getPostModerationContext } from './utils';
import { logger } from '../../logger';
import { TypeORMQueryFailedError } from '../../errors';

const worker =
  generateTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>({
    subscription: 'api.v1.source-post-moderation-rejected-notification',
    handler: async ({ post }, con) => {
      if (post.status !== SquadPostModerationStatus.Rejected) {
        return;
      }

      try {
        const moderationCtx = await getPostModerationContext(con, post);
        const ctx: NotificationPostModerationContext = {
          ...moderationCtx,
          userIds: [post.createdById],
        };

        return [{ type: NotificationType.SquadPostRejected, ctx }];
      } catch (err) {
        const error = err as TypeORMQueryFailedError;
        if (error?.name !== 'EntityNotFoundError') {
          logger.error(
            'failed sending notification for squad post moderation rejected',
            err,
          );
        }
      }
    },
  });

export default worker;
