import { IncomingWebhook } from '@slack/webhook';
import { Post, Comment } from '../entity';
import { getDiscussionLink } from './links';

const nullWebhook = { send: (): Promise<void> => Promise.resolve() };
export const webhooks = Object.freeze({
  content: process.env.SLACK_WEBHOOK
    ? new IncomingWebhook(process.env.SLACK_WEBHOOK)
    : nullWebhook,
  comments: process.env.SLACK_WEBHOOK
    ? new IncomingWebhook(process.env.SLACK_COMMENTS_WEBHOOK)
    : nullWebhook,
});

export const notifyNewComment = async (
  post: Post,
  userId: string,
  comment: string,
  commentId: string,
): Promise<void> => {
  await webhooks.comments.send({
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
            value: post.title ?? '',
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
  tags?: string[],
): Promise<void> => {
  await webhooks.content.send({
    text: 'Post was just reported!',
    attachments: [
      {
        title: post.title ?? `Post ${post.id}`,
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
          {
            title: 'Tags',
            value: tags?.join(', '),
          },
        ],
        color: '#FF1E1F',
      },
    ],
  });
};

export const notifyCommentReport = async (
  userId: string,
  comment: Comment,
  reason: string,
  note?: string,
): Promise<void> => {
  await webhooks.content.send({
    text: 'Comment was just reported!',
    attachments: [
      {
        title: comment.content,
        title_link: getDiscussionLink(comment.postId, comment.id),
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
            title: 'Note',
            value: note,
          },
        ],
        color: '#FF1E1F',
      },
    ],
  });
};
