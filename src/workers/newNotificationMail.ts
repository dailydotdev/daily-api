import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import {
  ArticlePost,
  Comment,
  getNotificationAndChildren,
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  Post,
  SharePost,
  Source,
  SourceRequest,
  Submission,
  User,
  WelcomePost,
} from '../entity';
import { getAuthorPostStats } from '../entity/posts';
import {
  addNotificationEmailUtm,
  baseNotificationEmailData,
  basicHtmlStrip,
  formatMailDate,
  getFirstName,
  pickImageUrl,
  sendEmail,
  truncatePostToTweet,
} from '../common';
import { DataSource } from 'typeorm';
import { SubmissionFailErrorMessage } from '../errors';
import { simplifyComment } from '../notifications/builder';
import { NotificationType } from '../notifications';

interface Data {
  notification: ChangeObject<Notification>;
}

const notificationToTemplateId: Record<NotificationType, string> = {
  community_picks_failed: 'd-43cf7ff439ff4391839e946940499b30',
  community_picks_succeeded: 'd-ee7d7cfc461a43b4be776f70940fa867',
  community_picks_granted: 'd-6d17b936f1f245e486f1a85323240332',
  article_picked: 'd-3d3402ec873640e788f549a0680c40bb',
  article_new_comment: 'd-aba78d1947b14307892713ad6c2cafc5',
  article_upvote_milestone: 'd-f9bff38d48dd4492b6db3dde0eebabd6',
  article_report_approved: 'd-dc6edf61c52442689e8870a434d8811d',
  article_analytics: 'd-97c75b0e2cf847399d20233455736ba0',
  source_approved: 'd-d79367f86f1e4ca5afdf4c1d39ff7214',
  source_rejected: 'd-48de63612ff944cb8156fec17f47f066',
  comment_mention: 'd-6949e2e50def4c6698900032973d469b',
  comment_reply: 'd-90c229bde4af427c8708a7615bfd85b4',
  comment_upvote_milestone: 'd-92bca6102e3a4b41b6fc3f532f050429',
  squad_post_added: 'd-e09e5eaa30174b678ba2adfd8d311fdb',
  squad_member_joined: 'd-2cfa3006175940c18cf4dcc2c09e1076',
  squad_new_comment: 'd-587c6c6fd1554fdf98e79b435b082f9e',
  squad_reply: 'd-cbb2de40b61840c38d3aa21028af0c68',
  squad_post_viewed: 'd-dc0eb578886c4f84a7dcc25515c7b6a4',
  squad_access: 'd-6b3de457947b415d93d0029361edaf1d',
  squad_blocked: '',
  promoted_to_admin: 'd-397a5e4a394a4b7f91ea33c29efb8d01',
  demoted_to_member: '',
  post_mention: '',
  promoted_to_moderator: 'd-b1dbd1e86ee14bf094f7616f7469fee8',
  squad_subscribe_to_notification: '',
};

type TemplateDataFunc = (
  con: DataSource,
  user: User,
  notification: Notification,
  attachments: NotificationAttachment[],
  avatars: NotificationAvatar[],
) => Promise<Record<string, string | number> | null>;
const notificationToTemplateData: Record<NotificationType, TemplateDataFunc> = {
  community_picks_failed: async (con, user, notification) => {
    const submission = await con
      .getRepository(Submission)
      .findOneBy({ id: notification.referenceId });
    if (!submission) {
      return;
    }
    return {
      submitted_at: formatMailDate(submission.createdAt),
      first_name: getFirstName(user.name),
      article_link: submission.url,
      reason:
        SubmissionFailErrorMessage[submission?.reason] ??
        SubmissionFailErrorMessage.GENERIC_ERROR,
    };
  },
  community_picks_succeeded: async (con, user, notification) => {
    const post = (await con
      .getRepository(Post)
      .findOneBy({ id: notification.referenceId })) as ArticlePost;
    const submission = await con
      .getRepository(Submission)
      .findOneBy({ url: post.url, userId: user.id });
    return {
      first_name: getFirstName(user.name),
      submitted_at: formatMailDate(submission.createdAt),
      post_title: truncatePostToTweet(post),
      post_image: post.image || pickImageUrl(post),
      article_link: post.url,
      discussion_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  community_picks_granted: async (con, user) => {
    return {
      first_name: getFirstName(user.name),
    };
  },
  article_picked: async (con, user, notification, attachments) => {
    const att = attachments[0];
    return {
      post_title: truncatePostToTweet(att),
      post_image: att.image,
      discussion_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  article_new_comment: async (con, user, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['post', 'user'],
    });
    if (!comment) {
      return;
    }
    const [commenter, post] = await Promise.all([comment.user, comment.post]);
    return {
      profile_image: commenter.image,
      full_name: commenter.name,
      post_title: truncatePostToTweet(post),
      post_image: (post as ArticlePost).image || pickImageUrl(post),
      new_comment: notification.description,
      discussion_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      user_reputation: commenter.reputation,
    };
  },
  article_upvote_milestone: async (con, user, notification, attachments) => {
    const att = attachments[0];
    return {
      post_title: truncatePostToTweet(att),
      post_image: att.image,
      discussion_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      upvotes: notification.uniqueKey,
      upvote_title: basicHtmlStrip(notification.title),
    };
  },
  article_report_approved: async (con, user, notification) => {
    const post = await con
      .getRepository(Post)
      .findOneBy({ id: notification.referenceId });
    return {
      post_title: truncatePostToTweet(post),
      post_image: (post as ArticlePost).image || pickImageUrl(post),
    };
  },
  article_analytics: async (con, user, notification) => {
    const [stats, post] = await Promise.all([
      getAuthorPostStats(con, user.id),
      con.getRepository(Post).findOneBy({ id: notification.referenceId }),
    ]);
    return {
      post_image: (post as ArticlePost).image || pickImageUrl(post),
      post_title: truncatePostToTweet(post),
      post_views: post.views,
      post_views_total: stats.numPostViews,
      post_upvotes: post.upvotes,
      post_upvotes_total: stats.numPostUpvotes,
      post_comments: post.comments,
      post_comments_total: stats.numPostComments,
      profile_link: addNotificationEmailUtm(user.permalink, notification.type),
    };
  },
  source_approved: async (con, user, notification, attachments, avatars) => {
    const av = avatars[0];
    const sourceRequest = await con
      .getRepository(SourceRequest)
      .findOneBy({ id: notification.referenceId });
    return {
      source_name: av.name,
      source_image: av.image,
      rss_link: sourceRequest.sourceFeed,
      source_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  source_rejected: async (con, user, notification) => {
    const sourceRequest = await con
      .getRepository(SourceRequest)
      .findOneBy({ id: notification.referenceId });
    return {
      first_name: getFirstName(user.name),
      rss_link: sourceRequest.sourceUrl,
    };
  },
  comment_mention: async (con, user, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['post', 'user'],
    });
    if (!comment) {
      return;
    }
    const [commenter, post] = await Promise.all([comment.user, comment.post]);
    return {
      full_name: commenter.name,
      commenter_profile_image: commenter.image,
      comment: notification.description,
      post_image: (post as ArticlePost).image || pickImageUrl(post),
      post_title: truncatePostToTweet(post),
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      user_reputation: commenter.reputation,
    };
  },
  comment_reply: async (con, user, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['parent', 'user', 'post'],
    });
    if (!comment) {
      return;
    }
    const [commenter, parent, post] = await Promise.all([
      comment.user,
      comment.parent,
      comment.post,
    ]);
    if (!commenter || !parent || !post) {
      return;
    }

    const parentUser = await parent.user;
    if (!parentUser) {
      return;
    }

    return {
      user_profile_image: parentUser.image,
      full_name: commenter.name,
      main_comment: simplifyComment(parent.content),
      new_comment: notification.description,
      post_title: truncatePostToTweet(post),
      discussion_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      user_reputation: parentUser.reputation,
      commenter_reputation: commenter.reputation,
      commenter_profile_image: commenter.image,
      user_name: parentUser.name,
    };
  },
  comment_upvote_milestone: async (con, user, notification) => {
    return {
      // Strip HTML tags
      upvote_title: basicHtmlStrip(notification.title),
      main_comment: notification.description,
      profile_image: user.image,
      discussion_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      user_name: user.name,
      user_reputation: user.reputation,
    };
  },
  squad_member_joined: async (con, user, notification) => {
    const [joinedUser, post] = await Promise.all([
      con.getRepository(User).findOneBy({ id: notification.uniqueKey }),
      con
        .getRepository(WelcomePost)
        .findOneBy({ id: notification.referenceId }),
    ]);
    const source = await post.source;
    if (!joinedUser || !source) {
      return;
    }
    return {
      full_name: joinedUser.name,
      profile_image: joinedUser.image,
      squad_name: source.name,
      squad_image: source.image,
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      user_reputation: joinedUser.reputation,
      new_member_handle: joinedUser.username,
    };
  },
  squad_post_added: async (con, user, notification) => {
    const post = await con.getRepository(SharePost).findOne({
      where: { id: notification.referenceId },
      relations: ['author', 'source'],
    });
    if (!post || !post?.sharedPostId) {
      return;
    }
    const [author, source, sharedPost] = await Promise.all([
      post.author,
      post.source,
      con.getRepository(Post).findOneBy({ id: post.sharedPostId }),
    ]);
    if (!author || !source || !sharedPost) {
      return;
    }
    return {
      full_name: author.name,
      profile_image: author.image,
      squad_name: source.name,
      squad_image: source.image,
      commentary: truncatePostToTweet(post),
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      post_image: (sharedPost as ArticlePost).image || pickImageUrl(sharedPost),
      post_title: truncatePostToTweet(sharedPost),
      user_reputation: author.reputation,
    };
  },
  squad_new_comment: async (con, user, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['post', 'user'],
    });
    if (!comment) {
      return;
    }
    const [commenter, post] = [
      await comment.user,
      (await comment.post) as SharePost,
    ];
    if (!post || !post?.sharedPostId || !post?.authorId) {
      return;
    }
    const [sharedPost, author, source] = await Promise.all([
      con.getRepository(Post).findOneBy({ id: post.sharedPostId }),
      post.author,
      post.source,
    ]);
    return {
      profile_image: commenter.image,
      full_name: commenter.name,
      squad_name: source.name,
      squad_image: source.image,
      post_title: truncatePostToTweet(sharedPost),
      post_image: (sharedPost as ArticlePost).image || pickImageUrl(post),
      new_comment: notification.description,
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      commenter_reputation: commenter.reputation,
      user_name: author.name,
      user_reputation: author.reputation,
      user_image: author.image,
      commentary: truncatePostToTweet(post),
    };
  },
  squad_reply: async (con, user, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['parent', 'user', 'post'],
    });
    if (!comment) {
      return;
    }
    const [commenter, parent, post] = await Promise.all([
      comment.user,
      comment.parent,
      comment.post,
    ]);
    if (!commenter || !parent || !post) {
      return;
    }

    const parentUser = await parent.user;
    if (!parentUser) {
      return;
    }

    const source = await post.source;
    return {
      full_name: commenter.name,
      profile_image: commenter.image,
      squad_name: source.name,
      squad_image: source.image,
      commenter_reputation: commenter.reputation,
      new_comment: notification.description,
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      user_name: parentUser.name,
      user_reputation: parentUser.reputation,
      user_image: parentUser.image,
      main_comment: simplifyComment(parent.content),
    };
  },
  squad_post_viewed: async (con, user, notification) => {
    const [post, viewer] = await Promise.all([
      con.getRepository(SharePost).findOne({
        where: { id: notification.referenceId },
        relations: ['author', 'source'],
      }),
      con.getRepository(User).findOneBy({ id: notification.uniqueKey }),
    ]);
    if (!post || !post?.sharedPostId || !viewer) {
      return;
    }
    const [author, source, sharedPost] = await Promise.all([
      post.author,
      post.source,
      con.getRepository(Post).findOneBy({ id: post.sharedPostId }),
    ]);
    if (!author || !source || !sharedPost) {
      return;
    }
    return {
      full_name: viewer.name,
      profile_image: viewer.image,
      squad_name: source.name,
      squad_image: source.image,
      commentary: truncatePostToTweet(post),
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      post_image: (sharedPost as ArticlePost).image || pickImageUrl(sharedPost),
      post_title: truncatePostToTweet(sharedPost),
      user_name: author.name,
      user_reputation: author.reputation,
      user_image: author.image,
    };
  },
  squad_access: async (con, user) => {
    return {
      full_name: user.name,
    };
  },
  squad_blocked: async () => {
    return null;
  },
  promoted_to_admin: async (con, user, notification) => {
    const source = await con
      .getRepository(Source)
      .findOneBy({ id: notification.referenceId });
    if (!source) {
      return;
    }
    return {
      first_name: getFirstName(user.name),
      squad_name: source.name,
      squad_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  squad_subscribe_to_notification: async () => {
    return null;
  },
  demoted_to_member: async () => {
    return null;
  },
  post_mention: async () => {
    return null;
  },
  promoted_to_moderator: async (con, user, notification) => {
    const source = await con
      .getRepository(Source)
      .findOneBy({ id: notification.referenceId });
    if (!source) {
      return;
    }
    return {
      first_name: getFirstName(user.name),
      squad_name: source.name,
      squad_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
};

const formatTemplateDate = <T extends Record<string, unknown>>(data: T): T => {
  return Object.keys(data).reduce((acc, key) => {
    if (typeof data[key] === 'number') {
      return { ...acc, [key]: (data[key] as number).toLocaleString() };
    }
    return acc;
  }, data);
};

const worker: Worker = {
  subscription: 'api.new-notification-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { id, userId } = data.notification;
    const [[notification, attachments, avatars], user] = await Promise.all([
      getNotificationAndChildren(con, id),
      con.getRepository(User).findOneBy({ id: userId }),
    ]);
    if (
      !user?.email ||
      !notification ||
      (!user?.notificationEmail && notification.public)
    ) {
      return;
    }
    const templateData = await notificationToTemplateData[notification.type](
      con,
      user,
      notification,
      attachments,
      avatars,
    );
    if (!templateData) {
      return;
    }
    const formattedData = formatTemplateDate(templateData);
    const templateId = notificationToTemplateId[notification.type];
    try {
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId,
        dynamicTemplateData: formattedData,
      });
    } catch (err) {
      logger.error(
        {
          err,
          templateId: templateId,
          dynamicTemplateData: formattedData,
        },
        'failed to send email',
      );
    }
  },
};

export default worker;
