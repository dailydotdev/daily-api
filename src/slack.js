import { IncomingWebhook } from '@slack/client';

const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK);

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

export const notifyNewSource = (userId, name, email, source) =>
  webhook.send({
    text: 'New source requested!',
    attachments: [{
      fields: [
        {
          title: 'User',
          value: userId,
        },
        {
          title: 'Name',
          value: name,
        },
        {
          title: 'Email',
          value: email,
        },
        {
          title: 'Source',
          value: source,
        },
      ],
      color: '#621FFF',
    }],
  });

