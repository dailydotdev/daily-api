import sgMail from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { Comment, Post } from '../entity';
import { getDiscussionLink } from './links';
import { pickImageUrl } from './post';
import { User } from './users';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const truncatePost = (post: Post): string =>
  post.title.length <= 80 ? post.title : `${post.title.substr(0, 77)}...`;

export const formatPostCreatedAt = (post: Post): string =>
  post.createdAt.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

export const truncateComment = (comment: Comment): string =>
  comment.content.length <= 85
    ? comment.content
    : `${comment.content.substr(0, 82)}...`;

export const baseNotificationEmailData: Pick<
  MailDataRequired,
  'from' | 'replyTo' | 'trackingSettings' | 'asm' | 'category'
> = {
  from: {
    email: 'informer@daily.dev',
    name: 'daily.dev',
  },
  replyTo: {
    email: 'hi@daily.dev',
    name: 'daily.dev',
  },
  trackingSettings: {
    openTracking: { enable: true },
  },
  asm: {
    groupId: 15003,
  },
  category: 'Notification',
};

export const sendEmail = async (data: MailDataRequired): Promise<void> => {
  if (process.env.SENDGRID_API_KEY) {
    await sgMail.send(data);
  }
};

export const getCommentedAuthorMailParams = (
  post: Post,
  comment: Comment,
  author: User,
  commenter: User,
): MailDataRequired => {
  const link = getDiscussionLink(post.id);
  return {
    ...baseNotificationEmailData,
    to: author.email,
    templateId: 'd-aba78d1947b14307892713ad6c2cafc5',
    dynamicTemplateData: {
      profile_image: commenter.image,
      full_name: commenter.name,
      post_title: post.title,
      post_image: post.image || pickImageUrl(post),
      new_comment: truncateComment(comment),
      discussion_link: link,
      user_reputation: commenter.reputation,
    },
  };
};
