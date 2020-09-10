import { IncomingWebhook } from '@slack/client';
import { Post } from '../entity';

const webhook = process.env.SLACK_WEBHOOK
  ? new IncomingWebhook(process.env.SLACK_WEBHOOK)
  : { send: (): Promise<void> => Promise.resolve() };

export const notifyPostReport = async (
  userId: string,
  post: Post,
  reason: string,
): Promise<void> => {
  await webhook.send({
    text: 'Post was just reported!',
    attachments: [
      {
        title: post.title,
        // eslint-disable-next-line @typescript-eslint/camelcase
        title_link: `${process.env.COMMENTS_PREFIX}/posts/${post.id}`,
        fields: [
          {
            title: 'User',
            value: userId,
          },
          {
            title: 'Reason',
            value: reason,
          },
        ],
        color: '#FF1E1F',
      },
    ],
  });
};
