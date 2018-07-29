import { IncomingWebhook } from '@slack/client';

const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK);

// eslint-disable-next-line import/prefer-default-export
export const notifyNewUser = (profile, provider) =>
  webhook.send({
    text: 'Daily just got a new user!',
    attachments: [{
      title: profile.name,
      author_name: provider.replace(/^\w/, c => c.toUpperCase()),
      thumb_url: profile.image,
    }],
  });

