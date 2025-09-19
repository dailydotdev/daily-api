import { messageToJson, TypedNotificationWorker } from '../worker';
import { articleNewCommentHandler } from './utils';

export const articleNewCommentCommentCommented: TypedNotificationWorker<'comment-commented'> =
  {
    subscription: 'api.article-new-comment-notification.comment-commented',
    handler: async ({ childCommentId }, con) => {
      return articleNewCommentHandler(con, childCommentId);
    },
    parseMessage: (message) => messageToJson(message),
  };
