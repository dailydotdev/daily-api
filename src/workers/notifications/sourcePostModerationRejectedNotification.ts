import { NotificationType } from '../../notifications/common';
import { NotificationPostModerationContext } from '../../notifications';
import { SourcePostModerationStatus } from '../../entity/SourcePostModeration';
import { getPostModerationContext } from './utils';
import { logger } from '../../logger';
import { TypeORMQueryFailedError } from '../../errors';
import { queryReadReplica } from '../../common/queryReadReplica';
import { TypedNotificationWorker } from '../worker';

const worker: TypedNotificationWorker<'api.v1.source-post-moderation-rejected'> =
  {
    subscription: 'api.source-post-moderation-rejected-notification',
    handler: async ({ post }, con) => {
      if (post.status !== SourcePostModerationStatus.Rejected) {
        return;
      }

      try {
        const moderationCtx = await queryReadReplica(con, ({ queryRunner }) => {
          return getPostModerationContext(queryRunner.manager, post);
        });
        const ctx: NotificationPostModerationContext = {
          ...moderationCtx,
          userIds: [post.createdById],
        };

        return [{ type: NotificationType.SourcePostRejected, ctx }];
      } catch (err) {
        const error = err as TypeORMQueryFailedError;
        if (error?.name !== 'EntityNotFoundError') {
          logger.error(
            { err, post },
            'failed sending notification for squad post moderation rejected',
          );
        }
      }
    },
  };

export default worker;
