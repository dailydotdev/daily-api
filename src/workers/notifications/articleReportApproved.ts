import { messageToJson } from '../worker';
import { Post, PostReport } from '../../entity';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { buildPostContext } from './utils';

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
    const reports = await con
      .getRepository(PostReport)
      .findBy({ postId: ctx.post.id });
    const users = [...new Set(reports.map(({ userId }) => userId))];
    if (!users.length) {
      return;
    }
    return users.map((userId) => ({
      type: 'article_report_approved',
      ctx: { ...ctx, userId },
    }));
  },
};

export default worker;
