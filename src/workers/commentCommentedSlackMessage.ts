import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { notifyNewComment } from '../common';
import { TypeORMQueryFailedError } from '../errors';

interface Data {
  userId: string;
  childCommentId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'comment-commented-slack-message',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con
        .getRepository(Comment)
        .findOne({ where: { id: data.childCommentId }, relations: ['post'] });
      if (!comment) {
        return;
      }
      const post = await comment.post;
      if (post.private) {
        return;
      }
      await notifyNewComment(post, data.userId, comment.content, comment.id);
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'Slack new comment message send',
      );
    } catch (originalError) {
      const err = originalError as TypeORMQueryFailedError;

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
