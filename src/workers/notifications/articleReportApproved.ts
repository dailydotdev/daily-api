import { messageToJson } from '../worker';
import { Post, PostReport } from '../../entity';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { buildPostContext } from './utils';
import { NotificationType } from '../../notifications/common';
import { queryReadReplica } from '../../common/queryReadReplica';

interface Data {
  post: ChangeObject<Post>;
}

const worker: NotificationWorker = {
  subscription: 'api.article-report-approved-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const ctx = await buildPostContext(con, data.post.id);
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
};

export default worker;
