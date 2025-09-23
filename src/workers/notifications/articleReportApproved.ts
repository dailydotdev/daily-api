import { messageToJson, TypedNotificationWorker } from '../worker';
import { PostReport } from '../../entity';
import { buildPostContext } from './utils';
import { NotificationType } from '../../notifications/common';
import { queryReadReplica } from '../../common/queryReadReplica';

export const articleReportApproved: TypedNotificationWorker<'post-banned-or-removed'> =
  {
    subscription: 'api.article-report-approved-notification',
    handler: async ({ post }, con) => {
      const ctx = await buildPostContext(con, post.id);
      if (!ctx) {
        return;
      }

      const reports = await queryReadReplica(con, ({ queryRunner }) => {
        return queryRunner.manager
          .getRepository(PostReport)
          .findBy({ postId: ctx.post.id });
      });

      const users = [...new Set(reports.map(({ userId }) => userId))];
      if (!users.length) {
        return;
      }
      return [
        {
          type: NotificationType.ArticleReportApproved,
          ctx: { ...ctx, userIds: users },
        },
      ];
    },
    parseMessage: (message) => messageToJson(message), // TODO: Clean this once we move all workers to TypedWorkers
  };
