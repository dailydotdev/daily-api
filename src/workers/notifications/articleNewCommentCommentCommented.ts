import { messageToJson } from '../worker';
import { NotificationWorker } from './worker';
import { articleNewCommentHandler } from './utils';

export interface Data {
  userId: string;
  childCommentId: string;
  postId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.article-new-comment-notification.comment-commented',
  handler: (message, con) => {
    const data: Data = messageToJson(message);
    return articleNewCommentHandler(con, data.childCommentId);
  },
};

export default worker;
