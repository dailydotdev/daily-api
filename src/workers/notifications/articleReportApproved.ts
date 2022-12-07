import { messageToJson } from '../worker';
import { Post, PostReport } from '../../entity';
import { NotificationPostContext } from '../../notifications';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: NotificationWorker = {
  subscription: 'api.article-report-approved-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const { post } = data;
    const reports = await con
      .getRepository(PostReport)
      .findBy({ postId: post.id });
    const users = [...new Set(reports.map(({ userId }) => userId))];
    if (!users.length) {
      return;
    }
    const ctx: Omit<NotificationPostContext, 'userId'> = { post };
    return users.map((userId) => ({
      type: 'article_report_approved',
      ctx: { ...ctx, userId },
    }));
  },
};

export default worker;
