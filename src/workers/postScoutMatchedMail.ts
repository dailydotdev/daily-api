import { templateId } from './../common/mailing';
import { messageToJson, Worker } from './worker';
import { Post, Submission } from '../entity';
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
  scoutId: string;
}

const worker: Worker = {
  subscription: 'post-scout-matched-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const user = await fetchUser(data.scoutId, con);
      const post = await con.getRepository(Post).findOneBy({ id: data.postId });
      const submission = await con
        .getRepository(Submission)
        .findOneBy({ url: post.url, userId: user.id });
      const link = getDiscussionLink(post.id);
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: templateId.postScoutMatched,
        dynamicTemplateData: {
          first_name: user.name.split(' ')[0],
          post_title: truncatePostToTweet(post),
          submitted_at: formatMailDate(submission.createdAt),
          post_image: post.image || pickImageUrl(post),
          article_link: post.url,
          discussion_link: link,
        },
      });
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'post scout matched email sent',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send post scout matched mail',
      );
    }
  },
};

export default worker;
