import { format } from 'date-fns';
import { messageToJson, Worker } from './worker';
import { Post, SourceDisplay } from '../entity';
import {
  baseNotificationEmailData,
  sendEmail,
  truncatePostToTweet,
} from '../common';
import { fetchUser } from '../common';
import { PostReport } from '../entity/PostReport';

interface Data {
  postId: string;
}

const reportReasons = new Map([
  ['BROKEN', 'Broken link'],
  ['NSFW', 'NSFW content'],
  ['CLICKBAIT', 'Clickbait'],
  ['LOW', 'Low quality content'],
]);

const worker: Worker = {
  subscription: 'post-banned-email',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const reports = await con
        .getRepository(PostReport)
        .find({ postId: data.postId });
      const reportsWithUser = await Promise.all(
        reports.map(async (report) => ({
          ...report,
          user: await fetchUser(report.userId),
        })),
      );
      if (reportsWithUser.length) {
        const post = await con.getRepository(Post).findOne(data.postId);
        const display = await con
          .getRepository(SourceDisplay)
          .findOne({ sourceId: post.sourceId });
        await sendEmail({
          ...baseNotificationEmailData,
          templateId: 'd-dc6edf61c52442689e8870a434d8811d',
          personalizations: reportsWithUser
            .filter(({ user }) => user?.email)
            .map(({ user, ...report }) => ({
              to: user.email,
              dynamicTemplateData: {
                first_name: user.name.split(' ')[0],
                timestamp: format(report.createdAt, 'PPppp'),
                report_type: reportReasons.get(report.reason),
                article_title: truncatePostToTweet(post),
                source_name: display.name,
                post_id: post.id,
              },
            })),
        });
        logger.info(
          {
            data,
            messageId: message.id,
          },
          'post banned or removed email sent',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to send post banned or removed email',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
