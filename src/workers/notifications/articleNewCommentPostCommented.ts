import { messageToJson, TypedNotificationWorker } from '../worker';
import { articleNewCommentHandler } from './utils';

export interface Data {
  userId: string;
  commentId: string;
  postId: string;
}

export const articleNewCommentPostCommented: TypedNotificationWorker<'post-commented'> =
  {
    subscription: 'api.article-new-comment-notification.post-commented',
    handler: ({ commentId }, con) => {
      return articleNewCommentHandler(con, commentId);
    },
    parseMessage(message) {
      // TODO: Clean this once we move all workers to TypedWorkers
      return messageToJson(message);
    },
  };
