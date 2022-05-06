import sgMail from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { Comment, Post } from '../entity';
import { getDiscussionLink } from './links';
import { pickImageUrl } from './post';
import { User } from './users';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const templateId = {
  postBanned: 'd-dc6edf61c52442689e8870a434d8811d',
  commentedAuthor: 'd-aba78d1947b14307892713ad6c2cafc5',
  commentCommented: 'd-90c229bde4af427c8708a7615bfd85b4',
  commentCommentedThread: 'd-62cb8a27d08a4951a49aade3b292c1ed',
  commentMentionedUser: 'd-6949e2e50def4c6698900032973d469b',
  commentFeatured: 'd-5888ea6c1baf482b9373fba25f0363ea',
  commentUpvoted: 'd-92bca6102e3a4b41b6fc3f532f050429',
  devcardEligible: 'd-680e36a387084cac87923963ea0656db',
  postAuthorMatched: 'd-3d3402ec873640e788f549a0680c40bb',
  postScoutMatched: 'no available tempalte yet',
  submissionChanged: 'no available tempalte yet',
  analyticsReport: 'd-97c75b0e2cf847399d20233455736ba0',
};

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
    groupId: 12850,
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
    templateId: templateId.commentedAuthor,
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
