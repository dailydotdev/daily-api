import { envBasedName, messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import {
  baseNotificationEmailData,
  sendEmail,
  truncateComment,
} from '../common';
import { fetchUser, getDiscussionLink, pickImageUrl } from '../common';

interface Data {
  userId: string;
  childCommentId: string;
  postId: string;
}

const worker: Worker = {
  topic: 'comment-commented',
  subscription: envBasedName('comment-commented-author-mail'),
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con
        .getRepository(Comment)
        .findOne(data.childCommentId, { relations: ['post'] });
      const post = await comment.post;
      if (post.authorId) {
        const [author, commenter] = await Promise.all([
          fetchUser(post.authorId),
          fetchUser(data.userId),
        ]);
        const link = getDiscussionLink(post.id);
        await sendEmail({
          ...baseNotificationEmailData,
          to: author.email,
          templateId: 'd-aba78d1947b14307892713ad6c2cafc5',
          dynamicTemplateData: {
            /* eslint-disable @typescript-eslint/camelcase */
            profile_image: commenter.image,
            full_name: commenter.name,
            post_title: post.title,
            post_image: post.image || pickImageUrl(post),
            new_comment: truncateComment(comment),
            discussion_link: link,
            user_reputation: commenter.reputation,
            /* eslint-enable @typescript-eslint/camelcase */
          },
        });
        logger.info(
          {
            data,
            messageId: message.id,
          },
          'comment author email sent',
        );
      }
      message.ack();
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to send comment author email',
      );
      if (err.name === 'QueryFailedError') {
        message.ack();
      } else {
        message.nack();
      }
    }
  },
};

export default worker;
