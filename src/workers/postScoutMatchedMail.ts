import { templateId } from '../common/mailing';
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
  scoutId: string;
}

// TODO:: Update the dynamic template data once available

const worker: Worker = {
  subscription: 'post-scout-matched-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const user = await fetchUser(data.scoutId);
      const post = await con.getRepository(Post).findOne(data.postId);
      const source = await post.source;
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: templateId.postScoutMatched,
        dynamicTemplateData: {
          post_title: truncatePostToTweet(post),
          published_at: formatPostCreatedAt(post),
          source_image: source.image,
          post_image: post.image || pickImageUrl(post),
          discussion_link: getDiscussionLink(post.id),
        },
      });
      logger.info(
        { data, messageId: message.messageId },
        'post scout matched email sent',
      );
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to send post scout matched mail',
      );
    }
  },
};

export default worker;
