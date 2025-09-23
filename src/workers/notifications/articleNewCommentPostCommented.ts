import { TypedNotificationWorker } from '../worker';
import { articleNewCommentHandler } from './utils';

export const articleNewCommentPostCommented: TypedNotificationWorker<'post-commented'> =
  {
    subscription: 'api.article-new-comment-notification.post-commented',
    handler: ({ commentId }, con) => articleNewCommentHandler(con, commentId),
  };
