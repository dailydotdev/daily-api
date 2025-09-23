import { TypedNotificationWorker } from '../worker';
import { buildPostContext, uniquePostOwners } from './utils';
import { NotificationType } from '../../notifications/common';
import { queryReadReplica } from '../../common/queryReadReplica';

export const articleAnalytics: TypedNotificationWorker<'send-analytics-report'> =
  {
    subscription: 'api.article-analytics-notification',
    handler: async ({ postId }, con) => {
      const ctx = await queryReadReplica(con, ({ queryRunner }) => {
        return buildPostContext(queryRunner.manager, postId);
      });

      if (!ctx) {
        return;
      }
      const users = uniquePostOwners(ctx.post);
      if (!users.length) {
        return;
      }
      return [
        {
          type: NotificationType.ArticleAnalytics,
          ctx: { ...ctx, userIds: users },
        },
      ];
    },
  };
