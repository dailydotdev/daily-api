import { envBasedName, messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import {
  baseNotificationEmailData,
  sendEmail,
  truncateComment,
} from '../common/mailing';
import { fetchUser } from '../common';

interface Data {
  userId: string;
  childCommentId: string;
  postId: string;
}

const worker: Worker = {
  topic: 'comment-commented',
  subscription: envBasedName('comment-commented-thread'),
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con
        .getRepository(Comment)
        .findOne(data.childCommentId, { relations: ['post', 'parent'] });
      const parent = await comment.parent;
      const threadFollowers = await con
        .getRepository(Comment)
        .createQueryBuilder()
        .select('"userId"')
        .distinct(true)
        .where('"parentId" = :parentId', { parentId: parent.id })
        .andWhere('"userId" != :authorId', { authorId: parent.userId })
        .andWhere('"userId" != :commenterId', { commenterId: comment.userId })
        .getRawMany();
      const [author, commenter, ...followers] = await Promise.all([
        fetchUser(parent.userId),
        fetchUser(data.userId),
        ...threadFollowers.map(({ userId }) => fetchUser(userId)),
      ]);
      const post = await comment.post;
      if (followers.length) {
        const link = `${process.env.COMMENTS_PREFIX}/posts/${post.id}`;
        await sendEmail({
          ...baseNotificationEmailData,
          to: followers.filter((user) => user?.email).map((user) => user.email),
          templateId: 'd-62cb8a27d08a4951a49aade3b292c1ed',
          dynamicTemplateData: {
            /* eslint-disable @typescript-eslint/camelcase */
            profile_image_commenter: author.image,
            profile_image_replier: commenter.image,
            full_name_commenter: author.name,
            full_name_replier: commenter.name,
            main_comment: truncateComment(parent),
            new_comment: truncateComment(comment),
            main_comment_link: link,
            post_title: post.title,
            discussion_link: link,
            user_reputation_commenter: author.reputation,
            user_reputation_replier: commenter.reputation,
            /* eslint-enable @typescript-eslint/camelcase */
          },
        });
        logger.info(
          {
            data,
            messageId: message.id,
          },
          'thread email sent',
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
        'failed to send comment email',
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
