import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { fetchUser, formatPostCreatedAt, pickImageUrl } from '../common';
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
        templateId: 'd-5888ea6c1baf482b9373fba25f0363ea',
        dynamicTemplateData: {
          post_title: truncatePost(post),
          published_at: formatPostCreatedAt(post),
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
