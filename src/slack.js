import { IncomingWebhook } from '@slack/client';

const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK);

export const notifyNewUser = (profile, provider) =>
  webhook.send({
    text: 'Daily just got a new user!',
    attachments: [{
      title: profile.name,
      author_name: provider.replace(/^\w/, c => c.toUpperCase()),
      thumb_url: profile.image,
      color: '#96FF1E',
    }],
  });

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

export const notifyNewSource = (userId, source) =>
  webhook.send({
    text: 'New source requested!',
    attachments: [{
      fields: [
        {
          title: 'User',
          value: userId,
        },
        {
          title: 'Source',
          value: source,
        },
      ],
      color: '#621FFF',
    }],
  });

