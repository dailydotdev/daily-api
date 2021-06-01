import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import {
  fetchUser,
  formatPostCreatedAt,
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
      const user = await fetchUser(data.authorId);
      const post = await con.getRepository(Post).findOne(data.postId);
      const source = await post.source;
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: 'd-3d3402ec873640e788f549a0680c40bb',
        dynamicTemplateData: {
          post_title: truncatePostToTweet(post),
          published_at: formatPostCreatedAt(post),
          source_image: source.image,
          post_image: post.image || pickImageUrl(post),
          discussion_link: getDiscussionLink(post.id),
        },
      });
      logger.info(
        {
          data,
          messageId: message.id,
        },
        'post author matched email sent',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to send post author matched mail',
      );
    }
  },
};

export default worker;
