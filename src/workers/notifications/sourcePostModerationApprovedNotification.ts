import { NotificationType } from '../../notifications/common';
import { NotificationPostContext } from '../../notifications';
import { buildPostContext } from './utils';
import { SourcePostModerationStatus } from '../../entity/SourcePostModeration';
import { queryReadReplica } from '../../common/queryReadReplica';
import { TypedNotificationWorker } from '../worker';

const worker: TypedNotificationWorker<'api.v1.source-post-moderation-approved'> =
  {
    subscription: 'api.source-post-moderation-approved-notification',
    handler: async ({ post: data }, con) => {
      if (data.status !== SourcePostModerationStatus.Approved) {
        return;
      }

      const postId = data?.postId;

      if (!postId) {
        return;
      }

      const baseCtx = await queryReadReplica(con, ({ queryRunner }) => {
        return buildPostContext(queryRunner.manager, postId);
      });
      const ctx: NotificationPostContext = {
        ...baseCtx!,
        moderated: data,
        userIds: [data.createdById],
      };

      return [{ type: NotificationType.SourcePostApproved, ctx }];
    },
  };

export default worker;
