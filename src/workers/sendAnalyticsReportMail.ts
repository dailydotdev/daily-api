import { differenceInHours } from 'date-fns';
import { messageToJson, Worker } from './worker';
import { getAuthorPostStats, Post } from '../entity';
import { fetchUser, pickImageUrl } from '../common';
import {
  baseNotificationEmailData,
  sendEmail,
  truncatePostToTweet,
} from '../common';

interface Data {
  postId: string;
}

const worker: Worker = {
  subscription: 'send-analytics-report-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const post = await con.getRepository(Post).findOne(data.postId);
      if (!post.sentAnalyticsReport && post.authorId) {
        const user = await fetchUser(post.authorId);
        const source = await post.source;
        const stats = await getAuthorPostStats(con, user.id);
        await sendEmail({
          ...baseNotificationEmailData,
          to: user.email,
          templateId: 'd-97c75b0e2cf847399d20233455736ba0',
          dynamicTemplateData: {
            first_name: user.name.split(' ')[0],
            source_image: source.image,
            post_image: post.image || pickImageUrl(post),
            post_title: truncatePostToTweet(post),
            live_hours: differenceInHours(new Date(), post.createdAt),
            post_views: post.views?.toLocaleString() ?? 0,
            post_views_total: stats.numPostViews?.toLocaleString() ?? 0,
            post_upvotes: post.upvotes?.toLocaleString() ?? 0,
            post_upvotes_total: stats.numPostUpvotes?.toLocaleString() ?? 0,
            post_comments: post.comments?.toLocaleString() ?? 0,
            user_reputation: user.reputation?.toLocaleString() ?? 0,
            profile_image: user.image,
            full_name: user.name,
            user_handle: user.username,
            profile_link: user.permalink,
          },
        });
        await con
          .getRepository(Post)
          .update(post.id, { sentAnalyticsReport: true });
        logger.info(
          {
            data,
            messageId: message.id,
          },
          'analytics report sent',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to send analytics report',
      );
    }
  },
};

export default worker;
