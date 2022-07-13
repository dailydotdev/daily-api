import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { getCommentedAuthorMailParams, sendEmail, User } from '../common';
import { fetchUser } from '../common';

interface Data {
  userId: string;
  commentId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-commented-author-mail',
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
      if (!post?.authorId && !post?.scoutId) {
        return;
      }

      const requests: Promise<User>[] = [];
      if (post?.authorId && post?.authorId !== data.userId) {
        requests.push(fetchUser(post.authorId));
      }

      if (post?.scoutId && post?.scoutId !== data.userId) {
        requests.push(fetchUser(post.scoutId));
      }

      if (requests.length === 0) {
        return;
      }

      requests.unshift(fetchUser(data.userId));
      const [commenter, ...authorScout] = await Promise.all(requests);

      await Promise.all(
        authorScout.map((author) =>
          sendEmail(
            getCommentedAuthorMailParams(post, comment, author, commenter),
          ),
        ),
      );
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'post commented author email sent',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send post commented author email',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
