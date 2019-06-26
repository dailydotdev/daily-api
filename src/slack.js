import { IncomingWebhook } from '@slack/client';

const webhook = process.env.SLACK_WEBHOOK ?
  new IncomingWebhook(process.env.SLACK_WEBHOOK) : { send: () => Promise.resolve() };

// eslint-disable-next-line import/prefer-default-export
export const notifyPostReport = (userId, post, reason) =>
  webhook.send({
    text: 'Post was just reported!',
    attachments: [{
      title: post.title,
      title_link: post.url,
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
    }],
  });
