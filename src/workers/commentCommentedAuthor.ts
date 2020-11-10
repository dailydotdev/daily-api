import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { getCommentedAuthorMailParams, sendEmail } from '../common';
import { fetchUser } from '../common';

interface Data {
  userId: string;
  childCommentId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'comment-commented-author-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con
        .getRepository(Comment)
        .findOne(data.childCommentId, { relations: ['post'] });
      const post = await comment.post;
      if (post.authorId && post.authorId !== data.userId) {
        const [author, commenter] = await Promise.all([
          fetchUser(post.authorId),
          fetchUser(data.userId),
        ]);
        await sendEmail(
          getCommentedAuthorMailParams(post, comment, author, commenter),
        );
        logger.info(
          {
            data,
            messageId: message.id,
          },
          'comment commented author email sent',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to send comment commented author email',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
