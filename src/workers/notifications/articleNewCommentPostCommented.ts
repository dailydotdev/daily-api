import { messageToJson } from '../worker';
import { NotificationWorker } from './worker';
import { articleNewCommentHandler } from './utils';

export interface Data {
  userId: string;
  commentId: string;
  postId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.article-new-comment-notification.post-commented',
  handler: (message, con) => {
    const data: Data = messageToJson(message);
    return articleNewCommentHandler(con, data.commentId);
  },
};

export default worker;
