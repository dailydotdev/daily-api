import { templateId } from './../common/mailing';
import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { fetchUser, formatMailDate, pickImageUrl } from '../common';
import { baseNotificationEmailData, sendEmail, truncatePost } from '../common';

interface Data {
  commentId: string;
}

const worker: Worker = {
  subscription: 'comment-featured-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con
        .getRepository(Comment)
        .findOne(data.commentId, { relations: ['post'] });
      const user = await fetchUser(comment.userId);
      const post = await comment.post;
      const source = await post.source;
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: templateId.commentFeatured,
        dynamicTemplateData: {
          post_title: truncatePost(post),
          published_at: formatMailDate(post.createdAt),
          profile_image: user.image,
          source_image: source.image,
          post_image: post.image || pickImageUrl(post),
          profile_link: user.permalink,
        },
      });
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'featured email sent',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send featured mail',
      );
    }
  },
};

export default worker;
