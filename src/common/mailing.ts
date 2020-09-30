import sgMail from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { Comment, Post } from '../entity';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const truncatePost = (post: Post): string =>
  post.title.length <= 80 ? post.title : `${post.title.substr(0, 77)}...`;

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
