import { IncomingWebhook } from '@slack/webhook';
import { Post } from '../entity';
import { getDiscussionLink } from './links';

export const webhook = process.env.SLACK_WEBHOOK
  ? new IncomingWebhook(process.env.SLACK_WEBHOOK)
  : { send: (): Promise<void> => Promise.resolve() };

export const notifyNewComment = async (
  post: Post,
  userId: string,
  comment: string,
  commentId: string,
): Promise<void> => {
  if (post.type === 'share') {
    return;
  }

  await webhook.send({
    text: 'New comment',
    attachments: [
      {
        title: comment,
        title_link: getDiscussionLink(post.id, commentId),
        fields: [
          {
            title: 'User',
            value: userId,
          },
          {
            title: 'Post title',
            value: post.title,
          },
        ],
        color: '#1DDC6F',
      },
    ],
  });
};

export const notifyPostReport = async (
  userId: string,
  post: Post,
  reason: string,
  comment?: string,
): Promise<void> => {
  await webhook.send({
    text: 'Post was just reported!',
    attachments: [
      {
        title: post.title,
        title_link: getDiscussionLink(post.id),
        fields: [
          {
            title: 'User',
            value: userId,
          },
          {
            title: 'Reason',
            value: reason,
          },
          {
            title: 'Comment',
            value: comment,
          },
        ],
        color: '#FF1E1F',
      },
    ],
  });
};
