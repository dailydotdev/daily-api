import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { notifyNewComment } from '../common';

interface Data {
  userId: string;
  commentId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-comment-slack-message',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con
        .getRepository(Comment)
        .findOne(data.commentId, { relations: ['post'] });
      if (!comment) {
        return;
      }
      const post = await comment.post;
      await notifyNewComment(post, data.userId, comment.content);
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'Slack new comment message send',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send new slack commented message',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
