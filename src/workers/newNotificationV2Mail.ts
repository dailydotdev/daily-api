import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import {
  ArticlePost,
  CollectionPost,
  Comment,
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  Post,
  PostRelation,
  PostRelationType,
  SharePost,
  Source,
  SourceRequest,
  Submission,
  User,
  WelcomePost,
  getAuthorPostStats,
} from '../entity';
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
import { DataSource, In, IsNull, Not } from 'typeorm';
import { SubmissionFailErrorMessage } from '../errors';
import { simplifyComment } from '../notifications/builder';
import {
  getNotificationV2AndChildren,
  NotificationType,
  streamNotificationUsers,
} from '../notifications/common';
import { processStreamInBatches } from '../common/streaming';

interface Data {
  notification: ChangeObject<NotificationV2>;
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
  collection_updated: 'd-c051ffef97a148b6a6f14d5edb46b553',
};

type TemplateData = Record<string, string | number>;

type TemplateDataFunc = (
  con: DataSource,
  users: User[],
  notification: NotificationV2,
  attachments: NotificationAttachmentV2[],
  avatars: NotificationAvatarV2[],
) => Promise<{ static: TemplateData; personalized?: TemplateData[] } | null>;
const notificationToTemplateData: Record<NotificationType, TemplateDataFunc> = {
  community_picks_failed: async (con, users, notification) => {
    const submission = await con
      .getRepository(Submission)
      .findOneBy({ id: notification.referenceId });
    if (!submission) {
      return;
    }
    return {
      static: {
        submitted_at: formatMailDate(submission.createdAt),
        article_link: submission.url,
        reason:
          SubmissionFailErrorMessage[submission?.reason] ??
          SubmissionFailErrorMessage.GENERIC_ERROR,
      },
      personalized: users.map((user) => ({
        first_name: getFirstName(user.name),
      })),
    };
  },
  community_picks_succeeded: async (con, users, notification) => {
    const post = (await con
      .getRepository(Post)
      .findOneBy({ id: notification.referenceId })) as ArticlePost;
    const submission = await con
      .getRepository(Submission)
      .findOneBy({ url: post.url, userId: users[0].id });
    return {
      static: {
        submitted_at: formatMailDate(submission.createdAt),
        post_title: truncatePostToTweet(post),
        post_image: post.image || pickImageUrl(post),
        article_link: post.url,
        discussion_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
      },
      personalized: users.map((user) => ({
        first_name: getFirstName(user.name),
      })),
    };
  },
  community_picks_granted: async (con, users) => {
    return {
      static: {},
      personalized: users.map((user) => ({
        first_name: getFirstName(user.name),
      })),
    };
  },
  article_picked: async (con, users, notification, attachments) => {
    const att = attachments[0];
    return {
      static: {
        post_title: truncatePostToTweet(att),
        post_image: att.image,
        discussion_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
      },
    };
  },
  article_new_comment: async (con, users, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['post', 'user'],
    });
    if (!comment) {
      return;
    }
    const [commenter, post] = await Promise.all([comment.user, comment.post]);
    return {
      static: {
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
      },
    };
  },
  article_upvote_milestone: async (con, users, notification, attachments) => {
    const att = attachments[0];
    return {
      static: {
        post_title: truncatePostToTweet(att),
        post_image: att.image,
        discussion_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
        upvotes: notification.uniqueKey,
        upvote_title: basicHtmlStrip(notification.title),
      },
    };
  },
  article_report_approved: async (con, users, notification) => {
    const post = await con
      .getRepository(Post)
      .findOneBy({ id: notification.referenceId });
    return {
      static: {
        post_title: truncatePostToTweet(post),
        post_image: (post as ArticlePost).image || pickImageUrl(post),
      },
    };
  },
  article_analytics: async (con, users, notification) => {
    const [stats, post] = await Promise.all([
      Promise.all(users.map((user) => getAuthorPostStats(con, user.id))),
      con.getRepository(Post).findOneBy({ id: notification.referenceId }),
    ]);
    return {
      static: {
        post_image: (post as ArticlePost).image || pickImageUrl(post),
        post_title: truncatePostToTweet(post),
        post_views: post.views,
        post_upvotes: post.upvotes,
        post_comments: post.comments,
      },
      personalized: users.map((user, i) => ({
        profile_link: addNotificationEmailUtm(
          user.permalink,
          notification.type,
        ),
        post_views_total: stats[i].numPostViews,
        post_upvotes_total: stats[i].numPostUpvotes,
        post_comments_total: stats[i].numPostComments,
      })),
    };
  },
  source_approved: async (con, users, notification, attachments, avatars) => {
    const av = avatars[0];
    const sourceRequest = await con
      .getRepository(SourceRequest)
      .findOneBy({ id: notification.referenceId });
    return {
      static: {
        source_name: av.name,
        source_image: av.image,
        rss_link: sourceRequest.sourceFeed,
        source_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
      },
    };
  },
  source_rejected: async (con, users, notification) => {
    const sourceRequest = await con
      .getRepository(SourceRequest)
      .findOneBy({ id: notification.referenceId });
    return {
      static: {
        rss_link: sourceRequest.sourceUrl,
      },
      personalized: users.map((user) => ({
        first_name: getFirstName(user.name),
      })),
    };
  },
  comment_mention: async (con, users, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['post', 'user'],
    });
    if (!comment) {
      return;
    }
    const [commenter, post] = await Promise.all([comment.user, comment.post]);
    return {
      static: {
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
      },
    };
  },
  comment_reply: async (con, users, notification) => {
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
      static: {
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
      },
    };
  },
  comment_upvote_milestone: async (con, users, notification) => {
    return {
      static: {
        // Strip HTML tags
        upvote_title: basicHtmlStrip(notification.title),
        main_comment: notification.description,
        discussion_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
      },
      personalized: users.map((user) => ({
        profile_image: user.image,
        user_name: user.name,
        user_reputation: user.reputation,
      })),
    };
  },
  squad_member_joined: async (con, users, notification) => {
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
      static: {
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
      },
    };
  },
  squad_post_added: async (con, users, notification) => {
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
      static: {
        full_name: author.name,
        profile_image: author.image,
        squad_name: source.name,
        squad_image: source.image,
        commentary: truncatePostToTweet(post),
        post_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
        post_image:
          (sharedPost as ArticlePost).image || pickImageUrl(sharedPost),
        post_title: truncatePostToTweet(sharedPost),
        user_reputation: author.reputation,
      },
    };
  },
  squad_new_comment: async (con, users, notification) => {
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
      static: {
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
      },
    };
  },
  squad_reply: async (con, users, notification) => {
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
      static: {
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
      },
    };
  },
  squad_post_viewed: async (con, users, notification) => {
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
      static: {
        full_name: viewer.name,
        profile_image: viewer.image,
        squad_name: source.name,
        squad_image: source.image,
        commentary: truncatePostToTweet(post),
        post_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
        post_image:
          (sharedPost as ArticlePost).image || pickImageUrl(sharedPost),
        post_title: truncatePostToTweet(sharedPost),
        user_name: author.name,
        user_reputation: author.reputation,
        user_image: author.image,
      },
    };
  },
  squad_access: async (con, users) => {
    return {
      static: {},
      personalized: users.map((user) => ({
        full_name: user.name,
      })),
    };
  },
  squad_blocked: async () => {
    return null;
  },
  promoted_to_admin: async (con, users, notification) => {
    const source = await con
      .getRepository(Source)
      .findOneBy({ id: notification.referenceId });
    if (!source) {
      return;
    }
    return {
      static: {
        squad_name: source.name,
        squad_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
      },
      personalized: users.map((user) => ({
        first_name: getFirstName(user.name),
      })),
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
  promoted_to_moderator: async (con, users, notification) => {
    const source = await con
      .getRepository(Source)
      .findOneBy({ id: notification.referenceId });
    if (!source) {
      return;
    }
    return {
      static: {
        squad_name: source.name,
        squad_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
      },
      personalized: users.map((user) => ({
        first_name: getFirstName(user.name),
      })),
    };
  },
  collection_updated: async (con, users, notification) => {
    const post = await con.getRepository(CollectionPost).findOne({
      where: {
        id: notification.referenceId,
      },
    });

    if (!post) {
      return;
    }

    const latestPostRelation = await con.getRepository(PostRelation).findOne({
      where: {
        postId: post.id,
        type: PostRelationType.Collection,
      },
      order: {
        createdAt: 'DESC',
      },
      relations: {
        relatedPost: {
          source: true,
        },
      },
    });

    if (!latestPostRelation) {
      return;
    }

    const latestRelatedPost =
      (await latestPostRelation.relatedPost) as ArticlePost;
    const latestRelatedPostSource = await latestRelatedPost.source;

    return {
      static: {
        post_title: truncatePostToTweet(post),
        post_image: post.image || pickImageUrl(post),
        post_upvotes: post.upvotes,
        post_comments: post.comments,
        post_link: addNotificationEmailUtm(
          notification.targetUrl,
          notification.type,
        ),
        post_timestamp: formatMailDate(post.metadataChangedAt),
        source_title: truncatePostToTweet(latestRelatedPost),
        source_image:
          latestRelatedPost.image || pickImageUrl(latestRelatedPost),
        source_timestamp: formatMailDate(latestRelatedPost.createdAt),
        source_name: latestRelatedPostSource.name,
      },
    };
  },
};

const formatTemplateDate = <T extends TemplateData>(data: T): T => {
  return Object.keys(data).reduce((acc, key) => {
    if (typeof data[key] === 'number') {
      return { ...acc, [key]: (data[key] as number).toLocaleString() };
    }
    return acc;
  }, data);
};

const BATCH_SIZE = 100;
const QUEUE_CONCURRENCY = 10;

const worker: Worker = {
  subscription: 'api.new-notification-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { id } = data.notification;
    const [notification, attachments, avatars] =
      await getNotificationV2AndChildren(con, id);
    if (!notification) {
      return;
    }
    const stream = await streamNotificationUsers(con, notification.id);
    try {
      await processStreamInBatches(
        stream,
        async (batch: { userId: string }[]) => {
          const users = await con.getRepository(User).find({
            where: {
              id: In(batch.map((b) => b.userId)),
              email: Not(IsNull()),
              notificationEmail: notification.public ? true : undefined,
            },
          });
          if (!users.length) {
            return;
          }
          const templateData = await notificationToTemplateData[
            notification.type
          ](con, users, notification, attachments, avatars);
          if (!templateData) {
            return;
          }
          const formattedData = formatTemplateDate(templateData.static);
          const personalized =
            templateData.personalized?.map(formatTemplateDate);
          const templateId = notificationToTemplateId[notification.type];
          await sendEmail({
            ...baseNotificationEmailData,
            templateId,
            dynamicTemplateData: formattedData,
            personalizations: users.map((user, i) => ({
              to: user.email,
              ...personalized?.[i],
            })),
          });
        },
        QUEUE_CONCURRENCY,
        BATCH_SIZE,
      );
    } catch (err) {
      logger.error(
        {
          err,
        },
        'failed to send notification email',
      );
    }
  },
};

export default worker;
