import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import {
  ArticlePost,
  CollectionPost,
  Comment,
  FreeformPost,
  getAuthorPostStats,
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  Post,
  PostRelation,
  PostRelationType,
  PostType,
  SharePost,
  Source,
  SourceRequest,
  SquadPublicRequest,
  SquadSource,
  Submission,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestType,
  UserTopReader,
  WelcomePost,
} from '../entity';
import {
  addNotificationEmailUtm,
  baseNotificationEmailData,
  basicHtmlStrip,
  CioTransactionalMessageTemplateId,
  formatMailDate,
  getOrganizationPermalink,
  getSourceLink,
  liveTimerDateFormat,
  mapCloudinaryUrl,
  pickImageUrl,
  sendEmail,
  truncatePostToTweet,
  truncateToTweet,
} from '../common';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { SubmissionFailErrorMessage } from '../errors';
import { simplifyComment } from '../notifications/builder';
import {
  getNotificationV2AndChildren,
  NotificationChannel,
  NotificationType,
  streamNotificationUsers,
} from '../notifications/common';
import { processStreamInBatches } from '../common/streaming';
import { counters } from '../telemetry';
import { SourcePostModeration } from '../entity/SourcePostModeration';
import { UserTransaction } from '../entity/user/UserTransaction';
import { formatCoresCurrency } from '../common/number';
import { ContentPreferenceOrganization } from '../entity/contentPreference/ContentPreferenceOrganization';
import { BriefPost } from '../entity/posts/BriefPost';
import { isPlusMember } from '../paddle';
import { BriefingSection } from '@dailydotdev/schema';
import type { JsonValue } from '@bufbuild/protobuf';
import { isNullOrUndefined } from '../common/object';
import { generateCampaignPostEmail } from '../common/campaign/post';
import { generateCampaignSquadEmail } from '../common/campaign/source';
import { PollPost } from '../entity/posts/PollPost';
import { OpportunityMatch } from '../entity/OpportunityMatch';

interface Data {
  notification: ChangeObject<NotificationV2>;
}

export const notificationToTemplateId: Record<NotificationType, string> = {
  source_post_approved: '62',
  source_post_submitted: '61',
  source_post_rejected: '', // we won't send an email on rejected ones
  community_picks_failed: '28',
  community_picks_succeeded: '27',
  community_picks_granted: '26',
  article_picked: '32',
  article_new_comment: '33',
  article_upvote_milestone: '22',
  article_report_approved: '30',
  article_analytics: '31',
  source_approved: '34',
  source_rejected: '35',
  comment_mention: '29',
  comment_reply: '37',
  comment_upvote_milestone: '44',
  squad_post_added: '17',
  squad_member_joined: '18',
  squad_new_comment: '19',
  squad_reply: '20',
  squad_blocked: '',
  promoted_to_admin: '12',
  demoted_to_member: '',
  post_mention: '54',
  promoted_to_moderator: '13',
  squad_subscribe_to_notification: '',
  collection_updated: '11',
  dev_card_unlocked: '9',
  source_post_added: '8',
  squad_public_submitted: '42',
  squad_public_rejected: '43',
  squad_public_approved: '41',
  post_bookmark_reminder: '',
  streak_reset_restore: '',
  squad_featured: '56',
  user_post_added: '58',
  user_given_top_reader: CioTransactionalMessageTemplateId.UserGivenTopReader,
  user_gifted_plus: CioTransactionalMessageTemplateId.UserReceivedPlusGift,
  user_received_award: CioTransactionalMessageTemplateId.UserReceivedAward,
  organization_member_joined:
    CioTransactionalMessageTemplateId.OrganizationMemberJoined,
  briefing_ready: '81',
  user_follow: '',
  marketing: '',
  new_user_welcome: '',
  announcements: '',
  in_app_purchases: '',
  campaign_post_completed: '79',
  campaign_squad_completed: '83',
  campaign_post_first_milestone: '80',
  campaign_squad_first_milestone: '82',
  new_opportunity_match: '87',
  post_analytics: '',
  poll_result: '84',
  poll_result_author: '84',
  warm_intro: '85',
};

type TemplateData = Record<string, unknown> & {
  sendAtMs?: number;
};

export type TemplateDataFunc = (
  con: DataSource,
  user: Pick<User, 'id' | 'username' | 'permalink'>,
  notification: NotificationV2,
  attachments: NotificationAttachmentV2[],
  avatars: NotificationAvatarV2[],
) => Promise<TemplateData | null>;
const notificationToTemplateData: Record<NotificationType, TemplateDataFunc> = {
  campaign_post_completed: generateCampaignPostEmail,
  campaign_squad_completed: generateCampaignSquadEmail,
  campaign_post_first_milestone: generateCampaignPostEmail,
  campaign_squad_first_milestone: generateCampaignSquadEmail,
  source_post_approved: async (con, user, notification) => {
    const post = await con.getRepository(Post).findOne({
      where: { id: notification.referenceId },
    });

    if (!post) {
      return null;
    }

    const [squad, createdBy, sharedPost] = await Promise.all([
      con.getRepository(SquadSource).findOne({
        where: { id: post.sourceId },
        select: ['name', 'type', 'handle', 'image'],
      }),
      post.author,
      post.type === PostType.Share
        ? con.getRepository(ArticlePost).findOne({
            where: { id: (post as SharePost).sharedPostId },
            select: ['title', 'image'],
          })
        : Promise.resolve(null),
    ]);

    if (!squad || !createdBy) {
      return null;
    }

    return {
      full_name: createdBy.name,
      profile_image: createdBy.image,
      squad_name: squad.name,
      squad_image: squad.image,
      commenter_reputation: createdBy.reputation.toString(),
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      post_image: sharedPost?.image || (post as FreeformPost).image,
      post_title:
        post.type === PostType.Share ? sharedPost?.title || '' : post.title,
      commentary:
        post.type === PostType.Share
          ? post.title
          : (post as FreeformPost).content,
    };
  },
  source_post_submitted: async (con, user, notification) => {
    const moderation: Pick<
      SourcePostModeration,
      | 'createdById'
      | 'sourceId'
      | 'image'
      | 'title'
      | 'content'
      | 'type'
      | 'sharedPostId'
    > | null = await con.getRepository(SourcePostModeration).findOne({
      where: { id: notification.referenceId },
      select: [
        'createdById',
        'sourceId',
        'image',
        'title',
        'content',
        'type',
        'sharedPostId',
      ],
    });

    if (!moderation) {
      return null;
    }

    const { sharedPostId } = moderation;
    const [squad, createdBy, sharedPost, moderator]: [
      Pick<SquadSource, 'type' | 'name' | 'handle' | 'image'> | null,
      Pick<User, 'name' | 'reputation' | 'image'> | null,
      Pick<ArticlePost, 'title' | 'image'> | null,
      Pick<User, 'name' | 'reputation' | 'image'> | null,
    ] = await Promise.all([
      con.getRepository(SquadSource).findOne({
        where: { id: moderation.sourceId },
        select: ['type', 'name', 'handle', 'image'],
      }),
      con.getRepository(User).findOne({
        where: { id: moderation.createdById },
        select: ['name', 'image', 'reputation'],
      }),
      moderation.type === PostType.Share && sharedPostId
        ? con.getRepository(ArticlePost).findOne({
            where: { id: sharedPostId },
            select: ['title', 'image'],
          })
        : Promise.resolve(null),
      con.getRepository(User).findOne({
        where: { id: user.id },
        select: ['name', 'image', 'reputation'],
      }),
    ]);

    if (!squad || !createdBy || !moderator) {
      return null;
    }

    return {
      full_name: moderator.name,
      profile_image: createdBy.image,
      squad_name: squad.name,
      squad_image: squad.image,
      creator_name: createdBy.name,
      creator_reputation: createdBy.reputation.toString(),
      post_link: `${getSourceLink(squad)}/moderate`,
      post_image: (sharedPost as ArticlePost)?.image || moderation.image,
      post_title: sharedPost?.title || moderation.title,
      commentary:
        moderation.type === PostType.Share
          ? moderation.title
          : moderation.content,
    };
  },
  source_post_rejected: async () => null,
  post_bookmark_reminder: async () => null,
  streak_reset_restore: async () => null,
  community_picks_failed: async (con, user, notification) => {
    const submission = await con
      .getRepository(Submission)
      .findOneBy({ id: notification.referenceId });
    if (!submission) {
      return null;
    }
    return {
      submitted_at: formatMailDate(submission.createdAt),
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
      .findOneByOrFail({ url: post.url!, userId: user.id });
    return {
      submitted_at: formatMailDate(submission.createdAt),
      post_title: truncatePostToTweet(post),
      post_image: post.image || pickImageUrl(post),
      article_link: post.url!,
      discussion_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  community_picks_granted: async () => {
    return {};
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
      return null;
    }
    const [commenter, post] = await Promise.all([comment.user, comment.post]);
    return {
      profile_image: commenter.image,
      full_name: commenter.name,
      post_title: truncatePostToTweet(post),
      post_image: (post as ArticlePost).image || pickImageUrl(post),
      new_comment: notification.description!,
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
      upvotes: notification.uniqueKey!,
      upvote_title: basicHtmlStrip(notification.title),
    };
  },
  article_report_approved: async (con, user, notification) => {
    const post = await con
      .getRepository(Post)
      .findOneByOrFail({ id: notification.referenceId });
    return {
      post_title: truncatePostToTweet(post),
      post_image: (post as ArticlePost).image || pickImageUrl(post),
    };
  },
  article_analytics: async (con, user, notification) => {
    const [stats, post] = await Promise.all([
      getAuthorPostStats(con, user.id),
      con.getRepository(Post).findOneByOrFail({ id: notification.referenceId }),
    ]);
    return {
      post_image: (post as ArticlePost).image || pickImageUrl(post),
      post_title: truncatePostToTweet(post),
      post_views: post.views,
      post_upvotes: post.upvotes,
      post_comments: post.comments,
      profile_link: addNotificationEmailUtm(user.permalink, notification.type),
      post_views_total: stats.numPostViews,
      post_upvotes_total: stats.numPostUpvotes,
      post_comments_total: stats.numPostComments,
    };
  },
  source_approved: async (con, user, notification, attachments, avatars) => {
    const av = avatars[0];
    const sourceRequest = await con
      .getRepository(SourceRequest)
      .findOneByOrFail({ id: notification.referenceId });
    return {
      source_name: av.name,
      source_image: av.image,
      rss_link: sourceRequest.sourceFeed!,
      source_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  source_rejected: async (con, user, notification) => {
    const sourceRequest = await con
      .getRepository(SourceRequest)
      .findOneByOrFail({ id: notification.referenceId });
    return {
      rss_link: sourceRequest.sourceUrl,
    };
  },
  comment_mention: async (con, user, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['post', 'user'],
    });
    if (!comment) {
      return null;
    }
    const [commenter, post] = await Promise.all([comment.user, comment.post]);
    return {
      full_name: commenter.name,
      commenter_profile_image: commenter.image,
      comment: notification.description!,
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
      return null;
    }
    const [commenter, parent, post] = await Promise.all([
      comment.user,
      comment.parent,
      comment.post,
    ]);
    if (!commenter || !parent || !post) {
      return null;
    }

    const parentUser = await parent.user;
    if (!parentUser) {
      return null;
    }

    return {
      user_profile_image: parentUser.image,
      full_name: commenter.name,
      main_comment: simplifyComment(parent.content),
      new_comment: notification.description!,
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
      main_comment: notification.description!,
      discussion_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  squad_featured: async (con, _, notification) => {
    const source = await con.getRepository(Source).findOne({
      where: { id: notification.referenceId },
      select: ['name', 'image'],
    });

    if (!source) {
      return null;
    }

    return {
      squad_name: source.name,
      squad_image: source.image,
      squad_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  squad_member_joined: async (con, user, notification) => {
    const [joinedUser, post] = await Promise.all([
      con.getRepository(User).findOneBy({ id: notification.uniqueKey }),
      con
        .getRepository(WelcomePost)
        .findOneByOrFail({ sourceId: notification.referenceId }),
    ]);
    const source = await post.source;
    if (!joinedUser || !source) {
      return null;
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
      new_member_handle: joinedUser.username!,
    };
  },
  squad_post_added: async (con, user, notification) => {
    const post = await con.getRepository(Post).findOne({
      where: { id: notification.referenceId },
      relations: ['author', 'source'],
    });
    if (!post) {
      return null;
    }
    const [author, source, sharedPost] = await Promise.all([
      post.author,
      post.source,
      post.type === PostType.Share
        ? con.getRepository(Post).findOneBy({
            id: (post as SharePost)?.sharedPostId,
          })
        : null,
    ]);
    if (!author || !source) {
      return null;
    }

    const baseObject = {
      full_name: author.name,
      profile_image: author.image,
      squad_name: source.name,
      squad_image: source.image,
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      user_reputation: author.reputation,
    };

    if (post.type === PostType.Freeform) {
      return {
        ...baseObject,
        commentary: truncateToTweet((post as FreeformPost)?.content),
        post_image: (post as FreeformPost).image || pickImageUrl(post),
        post_title: truncatePostToTweet(post),
      };
    }

    if (sharedPost && post.type === PostType.Share) {
      return {
        ...baseObject,
        commentary: truncatePostToTweet(post),
        post_image:
          (sharedPost as ArticlePost).image || pickImageUrl(sharedPost),
        post_title: truncatePostToTweet(sharedPost),
      };
    }
    return null;
  },
  squad_new_comment: async (con, user, notification) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: notification.referenceId },
      relations: ['post', 'user'],
    });
    if (!comment) {
      return null;
    }
    const [commenter, post] = [
      await comment.user,
      (await comment.post) as SharePost,
    ];
    if (!post || !post?.sharedPostId || !post?.authorId) {
      return null;
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
      post_title: truncatePostToTweet(sharedPost || undefined),
      post_image: (sharedPost as ArticlePost).image || pickImageUrl(post),
      new_comment: notification.description!,
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
      return null;
    }
    const [commenter, parent, post] = await Promise.all([
      comment.user,
      comment.parent,
      comment.post,
    ]);
    if (!commenter || !parent || !post) {
      return null;
    }

    const parentUser = await parent.user;
    if (!parentUser) {
      return null;
    }

    const source = await post.source;
    return {
      full_name: commenter.name,
      profile_image: commenter.image,
      squad_name: source.name,
      squad_image: source.image,
      commenter_reputation: commenter.reputation,
      new_comment: notification.description!,
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
  squad_blocked: async () => {
    return null;
  },
  promoted_to_admin: async (con, user, notification) => {
    const source = await con
      .getRepository(Source)
      .findOneBy({ id: notification.referenceId });
    if (!source) {
      return null;
    }
    return {
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
  post_mention: async (con, user, notification) => {
    const post = await con.getRepository(Post).findOne({
      where: { id: notification.referenceId },
      relations: ['author', 'source'],
    });
    if (!post) {
      return null;
    }
    const [author, source, sharedPost] = await Promise.all([
      post.author,
      post.source,
      post.type === PostType.Share
        ? con.getRepository(Post).findOneBy({
            id: (post as SharePost)?.sharedPostId,
          })
        : null,
    ]);
    if (!author || !source) {
      return null;
    }

    const baseObject = {
      full_name: author.name,
      profile_image: author.image,
      squad_name: source.name,
      squad_image: source.image,
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      user_reputation: author.reputation,
    };

    if (post.type === PostType.Freeform) {
      return {
        ...baseObject,
        commentary: truncateToTweet((post as FreeformPost)?.content),
        post_image: (post as FreeformPost).image || pickImageUrl(post),
        post_title: truncatePostToTweet(post),
      };
    }

    if (sharedPost && post.type === PostType.Share) {
      return {
        ...baseObject,
        commentary: truncatePostToTweet(post),
        post_image:
          (sharedPost as ArticlePost).image || pickImageUrl(sharedPost),
        post_title: truncatePostToTweet(sharedPost),
      };
    }
    return null;
  },
  promoted_to_moderator: async (con, user, notification) => {
    const source = await con
      .getRepository(Source)
      .findOneBy({ id: notification.referenceId });
    if (!source) {
      return null;
    }
    return {
      squad_name: source.name,
      squad_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
    };
  },
  collection_updated: async (con, user, notification) => {
    const post = await con.getRepository(CollectionPost).findOne({
      where: {
        id: notification.referenceId,
      },
    });

    if (!post) {
      return null;
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
      return null;
    }

    const latestRelatedPost =
      (await latestPostRelation.relatedPost) as ArticlePost;
    const latestRelatedPostSource = await latestRelatedPost.source;

    return {
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
      source_image: latestRelatedPost.image || pickImageUrl(latestRelatedPost),
      source_timestamp: formatMailDate(latestRelatedPost.createdAt),
      source_name: latestRelatedPostSource.name,
    };
  },
  dev_card_unlocked: async () => {
    return {};
  },
  source_post_added: async (con, user, notification) => {
    const post = (await con.getRepository(Post).findOne({
      where: {
        id: notification.referenceId,
      },
      relations: {
        source: true,
      },
    })) as ArticlePost;
    const source = await post.source;

    return {
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      post_image: post.image || pickImageUrl(post),
      post_title: truncatePostToTweet(post),
      source_name: source.name,
      source_image: source.image,
    };
  },
  squad_public_submitted: async (con, user, notification) => {
    const request = await con.getRepository(SquadPublicRequest).findOneOrFail({
      where: { id: notification.referenceId },
    });

    const squad = await request.source;

    return {
      squad_name: squad.name,
      squad_handle: squad.handle,
      squad_image: squad.image,
      timestamp: formatMailDate(request.createdAt),
    };
  },
  squad_public_rejected: async (con, user, notification) => {
    const request = await con.getRepository(SquadPublicRequest).findOneOrFail({
      where: { id: notification.referenceId },
      order: { createdAt: 'DESC' },
    });

    const squad = await request.source;

    return {
      squad_name: squad.name,
      squad_handle: squad.handle,
      squad_image: squad.image,
    };
  },
  squad_public_approved: async (con, user, notification) => {
    const request = await con.getRepository(SquadPublicRequest).findOneOrFail({
      where: { id: notification.referenceId },
      order: { createdAt: 'DESC' },
    });

    const squad = await request.source;

    return {
      squad_name: squad.name,
      squad_handle: squad.handle,
      squad_image: squad.image,
    };
  },
  user_post_added: async (con, user, notification) => {
    const [post, avatar] = await Promise.all([
      con.getRepository(Post).findOneOrFail({
        where: {
          id: notification.referenceId,
        },
      }),
      con.getRepository(NotificationAvatarV2).findOneOrFail({
        where: {
          id: notification.avatars[0],
        },
      }),
    ]);

    return {
      post_link: addNotificationEmailUtm(
        notification.targetUrl,
        notification.type,
      ),
      post_image: (post as ArticlePost).image || pickImageUrl(post),
      post_title: truncatePostToTweet(post),
      full_name: avatar.name,
      profile_image: avatar.image,
    };
  },
  user_given_top_reader: async (con, user, notification) => {
    const userTopReader = await con
      .getRepository(UserTopReader)
      .findOneByOrFail({
        userId: user.id,
        id: notification.referenceId,
      });

    const keyword = await userTopReader.keyword;
    if (!keyword) {
      throw new Error('Keyword not found');
    }

    return {
      image: userTopReader.image,
      issuedAt: formatMailDate(userTopReader.issuedAt),
      keyword: keyword?.flags?.title || keyword.value,
    };
  },
  user_gifted_plus: async (con, user) => {
    const { subscriptionFlags } = await con.getRepository(User).findOneOrFail({
      where: {
        id: user.id,
      },
      select: ['subscriptionFlags'],
    });

    if (!subscriptionFlags?.gifterId) {
      throw new Error('Gifter user not found');
    }

    const gifter = await con.getRepository(User).findOneOrFail({
      where: {
        id: subscriptionFlags.gifterId,
      },
      select: ['name', 'image'],
    });
    return {
      gifter_name: gifter.name,
      gifter_image: gifter.image,
    };
  },
  user_received_award: async (con, user, notification) => {
    const transaction = await con.getRepository(UserTransaction).findOneOrFail({
      where: {
        id: notification.referenceId,
        receiverId: user.id,
      },
      relations: {
        sender: true,
        product: true,
      },
    });

    const sender = await transaction.sender;
    const product = await transaction.product;

    const coreAmount =
      transaction.valueIncFees === 0
        ? 'Free'
        : `+${formatCoresCurrency(transaction.valueIncFees)}`;

    const title =
      transaction.valueIncFees === 0
        ? 'You just received an Award!'
        : `You just received ${coreAmount} Cores!`;

    return {
      title,
      core_amount: coreAmount,
      date: formatMailDate(transaction.createdAt),
      sender_image: sender.image,
      sender_name: sender.name,
      award_image: product.image,
      award_description: product?.flags?.description,
    };
  },
  organization_member_joined: async (con, user, notification) => {
    const organizationMember = await con
      .getRepository(ContentPreferenceOrganization)
      .findOneOrFail({
        where: {
          userId: user.id,
          organizationId: notification.referenceId,
        },
        relations: {
          user: true,
          organization: true,
        },
      });

    const organization = await organizationMember.organization;
    const member = await organizationMember.user;

    return {
      organization: {
        name: organization.name,
        href: getOrganizationPermalink(organization),
      },
      member: {
        name: member.name,
        image: member.image,
      },
    };
  },
  briefing_ready: async (con, user, notification) => {
    const personalizedDigest: Pick<
      UserPersonalizedDigest,
      'userId' | 'flags' | 'lastSendDate'
    > | null = await con.getRepository(UserPersonalizedDigest).findOne({
      select: ['userId', 'flags', 'lastSendDate'],
      where: {
        userId: user.id,
        type: UserPersonalizedDigestType.Brief,
      },
    });

    if (!personalizedDigest) {
      return null;
    }

    const post = await con.getRepository(BriefPost).findOne({
      where: { id: notification.referenceId },
      relations: {
        author: true,
      },
    });

    if (!post) {
      return null;
    }

    if (!Array.isArray(post.contentJSON)) {
      return null;
    }

    const author = await post.author;

    if (!author) {
      return null;
    }

    return {
      isPlus: isPlusMember(author.subscriptionFlags?.cycle),
      posts_number: post.flags.posts ?? 0,
      sources_number: post.flags.sources ?? 0,
      read_time: liveTimerDateFormat({
        value: new Date(),
        now: new Date(Date.now() + (post.readTime ?? 0) * 60 * 1000),
      }),
      saved_time: liveTimerDateFormat({
        value: new Date(),
        now: new Date(Date.now() + (post.flags.savedTime ?? 0) * 60 * 1000),
      }),
      read_link: `${process.env.COMMENTS_PREFIX}/posts/${post.id}`,
      sections: post.contentJSON.map((item: JsonValue) =>
        BriefingSection.fromJson(item),
      ),
      sendAtMs: personalizedDigest.lastSendDate?.getTime(),
    };
  },
  user_follow: async () => {
    return null;
  },
  marketing: async () => {
    return null;
  },
  new_user_welcome: async () => {
    return null;
  },
  announcements: async () => {
    return null;
  },
  in_app_purchases: async () => {
    return null;
  },
  new_opportunity_match: async (con, _, notification) => {
    const [foundUser, opportunityMatch] = await Promise.all([
      con.getRepository(User).findOneBy({ id: notification.uniqueKey }),
      con.getRepository(OpportunityMatch).findOneByOrFail({
        opportunityId: notification.referenceId,
        userId: notification.uniqueKey,
      }),
    ]);
    if (!foundUser || !opportunityMatch) {
      return null;
    }

    return {
      opportunity_link: notification.targetUrl,
    };
  },
  post_analytics: async () => {
    return null;
  },
  poll_result: async (con, _, notif) => {
    const poll = await con.getRepository(PollPost).findOneBy({
      id: notif.referenceId,
    });

    if (!poll) {
      return null;
    }

    return {
      post_link: addNotificationEmailUtm(notif.targetUrl, notif.type),
      analytics_link: addNotificationEmailUtm(
        notif.targetUrl + '/analytics',
        notif.type,
      ),
      post_title: poll.title,
      title: 'The poll you voted on has ended',
      subtitle:
        'Thanks for voting! The poll is now closed. Curious to see how others voted?',
    };
  },
  poll_result_author: async (con, _, notif) => {
    const poll = await con.getRepository(PollPost).findOneBy({
      id: notif.referenceId,
    });

    if (!poll) {
      return null;
    }

    return {
      post_link: addNotificationEmailUtm(notif.targetUrl, notif.type),
      analytics_link: addNotificationEmailUtm(
        notif.targetUrl + '/analytics',
        notif.type,
      ),
      post_title: poll.title,
      title: 'Your poll has ended',
      subtitle:
        'Your poll just wrapped up. Curious to see how everyone voted? The results are waiting.',
    };
  },
  warm_intro: async (con, user, notif) => {
    const match = await con.getRepository(OpportunityMatch).findOne({
      select: ['applicationRank'],
      where: {
        opportunityId: notif.referenceId,
        userId: user.id,
      },
    });
    if (!match) {
      return null;
    }

    const warmIntro = match.applicationRank?.warmIntro;
    if (!warmIntro) {
      return null;
    }

    return {
      title: `It's a match!`,
      copy: warmIntro,
    };
  },
};

const formatTemplateDate = <T extends TemplateData>(data: T): T => {
  return Object.keys(data).reduce((acc, key) => {
    switch (typeof data[key]) {
      case 'number':
        return { ...acc, [key]: (data[key] as number).toLocaleString() };
      case 'string':
        return { ...acc, [key]: mapCloudinaryUrl(data[key]) };
    }
    return acc;
  }, data);
};

const BATCH_SIZE = 1;
const QUEUE_CONCURRENCY = 100;

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
    const stream = await streamNotificationUsers(
      con,
      notification.id,
      NotificationChannel.Email,
    );
    try {
      await processStreamInBatches(
        stream,
        async (batch: { userId: string }[]) => {
          const users = await con.getRepository(User).find({
            select: ['id', 'username', 'email'],
            where: {
              id: In(batch.map((b) => b.userId)),
              email: Not(IsNull()),
            },
          });
          if (!users.length) {
            return;
          }
          await Promise.all(
            users.map(async (user) => {
              const templateDataFunc =
                notificationToTemplateData[notification.type];
              const templateData = await templateDataFunc(
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
              await sendEmail({
                ...baseNotificationEmailData,
                transactional_message_id: templateId,
                message_data: formattedData,
                identifiers: {
                  id: user.id,
                },
                to: user.email,
                send_at:
                  !isNullOrUndefined(templateData.sendAtMs) &&
                  templateData.sendAtMs > Date.now()
                    ? Math.floor(templateData.sendAtMs / 1000) // cio accepts seconds
                    : undefined,
              });
            }),
          );
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
      counters?.background?.notificationFailed?.add(1, { channel: 'email' });
    }
  },
};

export default worker;
