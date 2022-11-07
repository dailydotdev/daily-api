import { templateId } from './../common/mailing';
import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import {
  baseNotificationEmailData,
  sendEmail,
  truncateComment,
} from '../common';
import { fetchUser, getDiscussionLink } from '../common';

interface Data {
  userId: string;
  childCommentId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'comment-commented-thread',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con.getRepository(Comment).findOne({
        where: { id: data.childCommentId },
        relations: ['post', 'parent'],
      });
      if (!comment) {
        return;
      }
      const parent = await comment.parent;
      const post = await comment.post;
      const threadFollowers = await con
        .getRepository(Comment)
        .createQueryBuilder()
        .select('"userId"')
        .distinct(true)
        .where('"parentId" = :parentId', { parentId: parent.id })
        .andWhere('"userId" != :authorId', { authorId: parent.userId })
        .andWhere('"userId" != :commenterId', { commenterId: comment.userId })
        .andWhere('"userId" != :postAuthorId', {
          postAuthorId: post.authorId ?? '',
        })
        .getRawMany();
      const [author, commenter, ...followers] = await Promise.all([
        fetchUser(parent.userId, con),
        fetchUser(data.userId, con),
        ...threadFollowers.map(({ userId }) => fetchUser(userId, con)),
      ]);
      if (followers.length) {
        const link = getDiscussionLink(post.id);
        await sendEmail({
          ...baseNotificationEmailData,
          templateId: templateId.commentCommentedThread,
          personalizations: followers
            .filter((user) => user?.email)
            .map((user) => ({
              to: user.email,
              dynamicTemplateData: {
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
              },
            })),
        });
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'thread email sent',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send thread email',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
