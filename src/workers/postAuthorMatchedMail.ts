import { templateId } from './../common/mailing';
import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import {
  fetchUser,
  formatMailDate,
  getDiscussionLink,
  pickImageUrl,
} from '../common';
import {
  baseNotificationEmailData,
  sendEmail,
  truncatePostToTweet,
} from '../common';

interface Data {
  postId: string;
  authorId: string;
}

const worker: Worker = {
  subscription: 'post-author-matched-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const user = await fetchUser(data.authorId, con);
      const post = await con.getRepository(Post).findOne(data.postId);
      const source = await post.source;
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: templateId.postAuthorMatched,
        dynamicTemplateData: {
          post_title: truncatePostToTweet(post),
          published_at: formatMailDate(post.createdAt),
          source_image: source.image,
          post_image: post.image || pickImageUrl(post),
          discussion_link: getDiscussionLink(post.id),
        },
      });
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'post author matched email sent',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send post author matched mail',
      );
    }
  },
};

export default worker;
