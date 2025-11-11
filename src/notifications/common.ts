import { ValidationError } from 'apollo-server-errors';
import { DataSource, EntityManager, IsNull, QueryRunner } from 'typeorm';
import {
  NotFoundError,
  TypeOrmError,
  TypeORMQueryFailedError,
} from '../errors';
import { ReadStream } from 'fs';
import { SourcePostModeration } from '../entity/SourcePostModeration';
import { ChangeObject } from '../types';
import { type NotificationPreferencePost } from '../entity/notifications/NotificationPreferencePost';
import { type NotificationPreferenceComment } from '../entity/notifications/NotificationPreferenceComment';
import { type NotificationPreferenceSource } from '../entity/notifications/NotificationPreferenceSource';
import { type NotificationPreferenceUser } from '../entity/notifications/NotificationPreferenceUser';
import { NotificationAttachmentV2 } from '../entity/notifications/NotificationAttachmentV2';
import { NotificationAvatarV2 } from '../entity/notifications/NotificationAvatarV2';
import {
  NotificationV2,
  type NotificationReferenceType,
} from '../entity/notifications/NotificationV2';
import { UserNotification } from '../entity/notifications/UserNotification';
import type { ConnectionManager } from '../entity/posts';
import { Comment } from '../entity/Comment';
import type { UserNotificationFlags } from '../entity/user/User';

export enum NotificationType {
  CommunityPicksFailed = 'community_picks_failed',
  CommunityPicksSucceeded = 'community_picks_succeeded',
  CommunityPicksGranted = 'community_picks_granted',
  ArticlePicked = 'article_picked',
  ArticleNewComment = 'article_new_comment',
  ArticleUpvoteMilestone = 'article_upvote_milestone',
  ArticleReportApproved = 'article_report_approved',
  ArticleAnalytics = 'article_analytics',
  SourceApproved = 'source_approved',
  SourceRejected = 'source_rejected',
  CommentMention = 'comment_mention',
  CommentReply = 'comment_reply',
  CommentUpvoteMilestone = 'comment_upvote_milestone',
  SquadPostAdded = 'squad_post_added',
  SquadMemberJoined = 'squad_member_joined',
  SquadNewComment = 'squad_new_comment',
  SquadReply = 'squad_reply',
  SquadSubscribeToNotification = 'squad_subscribe_to_notification',
  SquadBlocked = 'squad_blocked',
  SquadFeatured = 'squad_featured',
  PromotedToAdmin = 'promoted_to_admin',
  DemotedToMember = 'demoted_to_member',
  PromotedToModerator = 'promoted_to_moderator',
  PostMention = 'post_mention',
  CollectionUpdated = 'collection_updated',
  DevCardUnlocked = 'dev_card_unlocked',
  SourcePostAdded = 'source_post_added',
  SourcePostApproved = 'source_post_approved',
  SourcePostRejected = 'source_post_rejected',
  SourcePostSubmitted = 'source_post_submitted',
  SquadPublicApproved = 'squad_public_approved',
  SquadPublicRejected = 'squad_public_rejected',
  SquadPublicSubmitted = 'squad_public_submitted',
  PostBookmarkReminder = 'post_bookmark_reminder',
  StreakResetRestore = 'streak_reset_restore',
  UserPostAdded = 'user_post_added',
  UserTopReaderBadge = 'user_given_top_reader',
  UserGiftedPlus = 'user_gifted_plus',
  UserReceivedAward = 'user_received_award',
  OrganizationMemberJoined = 'organization_member_joined',
  CampaignPostCompleted = 'campaign_post_completed',
  CampaignSquadCompleted = 'campaign_squad_completed',
  BriefingReady = 'briefing_ready',
  UserFollow = 'user_follow',
  Marketing = 'marketing',
  NewUserWelcome = 'new_user_welcome',
  Announcements = 'announcements',
  InAppPurchases = 'in_app_purchases',
  CampaignPostFirstMilestone = 'campaign_post_first_milestone',
  CampaignSquadFirstMilestone = 'campaign_squad_first_milestone',
  NewOpportunityMatch = 'new_opportunity_match',
  PostAnalytics = 'post_analytics',
  PollResult = 'poll_result',
  PollResultAuthor = 'poll_result_author',
  WarmIntro = 'warm_intro',
  RecruiterRejectedCandidateMatch = 'recruiter_rejected_candidate_match',
}

export enum NotificationPreferenceType {
  Post = 'post',
  Comment = 'comment',
  Source = 'source',
  User = 'user',
}

export enum NotificationPreferenceStatus {
  Muted = 'muted',
  Subscribed = 'subscribed',
}

export enum NotificationChannel {
  Email = 'email',
  InApp = 'inApp',
}

export const notificationPreferenceMap: Partial<
  Record<NotificationType, NotificationPreferenceType>
> = {
  [NotificationType.ArticleNewComment]: NotificationPreferenceType.Post,
  [NotificationType.SquadNewComment]: NotificationPreferenceType.Post,
  [NotificationType.CommentReply]: NotificationPreferenceType.Comment,
  [NotificationType.SquadReply]: NotificationPreferenceType.Comment,
  [NotificationType.SquadPostAdded]: NotificationPreferenceType.Source,
  [NotificationType.SquadMemberJoined]: NotificationPreferenceType.Source,
  [NotificationType.CollectionUpdated]: NotificationPreferenceType.Post,
  [NotificationType.SourcePostAdded]: NotificationPreferenceType.Source,
  [NotificationType.UserPostAdded]: NotificationPreferenceType.User,
  [NotificationType.UserTopReaderBadge]: NotificationPreferenceType.User,
  [NotificationType.SourcePostSubmitted]: NotificationPreferenceType.Source,
  [NotificationType.SquadFeatured]: NotificationPreferenceType.Source,
  [NotificationType.PollResult]: NotificationPreferenceType.Post,
  [NotificationType.PollResultAuthor]: NotificationPreferenceType.Post,
};

export const DEFAULT_NOTIFICATION_SETTINGS: UserNotificationFlags = {
  [NotificationType.ArticleNewComment]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.CommentReply]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.ArticleUpvoteMilestone]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.CommentUpvoteMilestone]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.PostMention]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.CommentMention]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SquadNewComment]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.UserReceivedAward]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.ArticleReportApproved]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.StreakResetRestore]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  ['streak_reminder']: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.UserTopReaderBadge]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.DevCardUnlocked]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SourcePostAdded]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SquadPostAdded]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.UserPostAdded]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.CollectionUpdated]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.PostBookmarkReminder]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.PromotedToAdmin]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.PromotedToModerator]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SourceApproved]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SourceRejected]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SourcePostSubmitted]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SourcePostApproved]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SourcePostRejected]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.BriefingReady]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.ArticlePicked]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.ArticleAnalytics]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SquadMemberJoined]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SquadReply]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SquadBlocked]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.DemotedToMember]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.SquadFeatured]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.Marketing]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.NewUserWelcome]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.Announcements]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.InAppPurchases]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.NewOpportunityMatch]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.PostAnalytics]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.PollResult]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
  [NotificationType.PollResultAuthor]: {
    email: NotificationPreferenceStatus.Subscribed,
    inApp: NotificationPreferenceStatus.Subscribed,
  },
};

export const commentReplyNotificationTypes = [
  NotificationType.CommentReply,
  NotificationType.SquadReply,
];

export const postNewCommentNotificationTypes = [
  NotificationType.ArticleNewComment,
  NotificationType.SquadNewComment,
];

type NotificationPreferenceUnion = NotificationPreferenceComment &
  NotificationPreferencePost &
  NotificationPreferenceSource;

type Properties = Pick<NotificationPreferencePost, 'postId'> &
  Pick<NotificationPreferenceComment, 'commentId'> &
  Pick<NotificationPreferenceSource, 'sourceId'> &
  Pick<NotificationPreferenceUser, 'referenceUserId'>;

const notificationPreferenceProp: Record<
  NotificationPreferenceType,
  keyof Properties
> = {
  post: 'postId',
  comment: 'commentId',
  source: 'sourceId',
  user: 'referenceUserId',
};

const getRepository = (
  con: DataSource | EntityManager,
  type: NotificationPreferenceType,
) => {
  switch (type) {
    case NotificationPreferenceType.Post:
      return con.getRepository('NotificationPreferencePost');
    case NotificationPreferenceType.Comment:
      return con.getRepository('NotificationPreferenceComment');
    case NotificationPreferenceType.Source:
      return con.getRepository('NotificationPreferenceSource');
    case NotificationPreferenceType.User:
      return con.getRepository('NotificationPreferenceUser');
    default:
      throw new ValidationError('Notification type not supported');
  }
};

const getReferenceId = async (
  con: DataSource | EntityManager,
  type: NotificationType,
  referenceId: string,
) => {
  if (postNewCommentNotificationTypes.includes(type)) {
    const comment = await con
      .getRepository(Comment)
      .findOneBy({ id: referenceId });

    return comment?.postId ?? referenceId;
  }

  if (commentReplyNotificationTypes.includes(type)) {
    const parentComment = await con.getRepository(Comment).findOne({
      select: ['parentId'],
      where: { id: referenceId },
    });
    if (parentComment?.parentId) {
      return parentComment.parentId;
    }
  }

  return referenceId;
};

export const saveNotificationPreference = async (
  con: DataSource | EntityManager,
  userId: string,
  referenceId: string,
  notificationType: NotificationType,
  status: NotificationPreferenceStatus,
) => {
  const type = notificationPreferenceMap[notificationType];

  if (!type) {
    throw new ValidationError('Notification type not supported');
  }

  const prop = notificationPreferenceProp[type];
  const id = await getReferenceId(con, notificationType, referenceId);
  const params: Partial<NotificationPreferenceUnion> = {
    type,
    userId,
    status,
    notificationType,
    referenceId: id,
    [prop]: id,
  };

  try {
    await getRepository(con, type)
      .createQueryBuilder()
      .insert()
      .values(params)
      .orUpdate(['status'], ['referenceId', 'userId', 'notificationType'])
      .execute();
  } catch (originalError) {
    const err = originalError as TypeORMQueryFailedError;

    if (err.code === TypeOrmError.FOREIGN_KEY) {
      throw new NotFoundError('Invalid reference id');
    }

    throw err;
  }
};

export const getNotificationV2AndChildren = (
  con: DataSource,
  id: string,
): Promise<
  [NotificationV2 | null, NotificationAttachmentV2[], NotificationAvatarV2[]]
> => {
  return Promise.all([
    con.getRepository(NotificationV2).findOneBy({ id }),
    con
      .createQueryBuilder()
      .select('na.*')
      .from(NotificationAttachmentV2, 'na')
      .innerJoin(NotificationV2, 'n', 'na.id = any(n.attachments)')
      .where('n.id = :id', { id })
      .orderBy('array_position(n.attachments, na.id)', 'ASC')
      .getRawMany(),
    con
      .createQueryBuilder()
      .select('na.*')
      .from(NotificationAvatarV2, 'na')
      .innerJoin(NotificationV2, 'n', 'na.id = any(n.avatars)')
      .where('n.id = :id', { id })
      .orderBy('array_position(n.avatars, na.id)', 'ASC')
      .getRawMany(),
  ]);
};

export const streamNotificationUsers = (
  con: DataSource,
  id: string,
  channel: NotificationChannel,
): Promise<ReadStream> => {
  let query = con
    .createQueryBuilder()
    .select('un."userId"')
    .from(UserNotification, 'un')
    .innerJoin('user', 'u', 'un."userId" = u.id')
    .innerJoin(NotificationV2, 'n', 'un."notificationId" = n.id')
    .where('un."notificationId" = :id', { id });

  if (channel === NotificationChannel.InApp) {
    query = query
      .andWhere('un.public = true')
      .andWhere(
        `COALESCE(u."notificationFlags" -> n.type ->> 'inApp', 'subscribed') != 'muted'`,
      );
  } else if (channel === NotificationChannel.Email) {
    query = query.andWhere(
      `COALESCE(u."notificationFlags" -> n.type ->> 'email', 'subscribed') != 'muted'`,
    );
  }

  return query.stream();
};

export const getUnreadNotificationsCount = async (
  con: DataSource | QueryRunner,
  userId: string,
) =>
  await con.manager.getRepository(UserNotification).count({
    where: {
      userId,
      public: true,
      readAt: IsNull(),
    },
  });

enum UserNotificationUniqueKey {
  PostAdded = 'post_added',
}

const notificationTypeToUniqueKey: Partial<
  Record<NotificationType, UserNotificationUniqueKey>
> = {
  [NotificationType.SquadPostAdded]: UserNotificationUniqueKey.PostAdded,
  [NotificationType.SourcePostAdded]: UserNotificationUniqueKey.PostAdded,
  [NotificationType.UserPostAdded]: UserNotificationUniqueKey.PostAdded,
};

export const generateUserNotificationUniqueKey = ({
  type,
  referenceId,
  referenceType,
  dedupKey,
}: {
  type: NotificationType;
  referenceId?: string;
  referenceType?: NotificationReferenceType;
  dedupKey?: string;
}): string | null => {
  const uniqueKey = notificationTypeToUniqueKey[type];

  if (!uniqueKey) {
    return null;
  }

  return [
    uniqueKey,
    dedupKey ? `dedup_${dedupKey}` : referenceId,
    referenceType,
  ]
    .filter(Boolean)
    .join(':');
};

export const cleanupSourcePostModerationNotifications = async (
  con: ConnectionManager,
  post: ChangeObject<SourcePostModeration>,
) => {
  if (!post?.id) {
    return;
  }

  await con.getRepository(NotificationV2).delete({
    referenceId: post.id,
    referenceType: 'post_moderation',
    type: NotificationType.SourcePostSubmitted,
  });
};
