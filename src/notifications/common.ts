import {
  NotificationPreferenceComment,
  NotificationPreferencePost,
  NotificationPreferenceSource,
  Comment,
} from '../entity';
import { ValidationError } from 'apollo-server-errors';
import { DataSource, EntityManager } from 'typeorm';
import { NotFoundError, TypeOrmError } from '../errors';

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
  SquadAccess = 'squad_access',
  SquadPostAdded = 'squad_post_added',
  SquadMemberJoined = 'squad_member_joined',
  SquadNewComment = 'squad_new_comment',
  SquadReply = 'squad_reply',
  SquadPostViewed = 'squad_post_viewed',
  SquadSubscribeToNotification = 'squad_subscribe_to_notification',
  SquadBlocked = 'squad_blocked',
  PromotedToAdmin = 'promoted_to_admin',
  DemotedToMember = 'demoted_to_member',
  PromotedToModerator = 'promoted_to_moderator',
  PostMention = 'post_mention',
  CollectionUpdated = 'collection_updated',
}

export enum NotificationPreferenceType {
  Post = 'post',
  Comment = 'comment',
  Source = 'source',
}

export enum NotificationPreferenceStatus {
  Muted = 'muted',
  Subscribed = 'subscribed',
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
  Pick<NotificationPreferenceSource, 'sourceId'>;

const notificationPreferenceProp: Record<
  NotificationPreferenceType,
  keyof Properties
> = {
  post: 'postId',
  comment: 'commentId',
  source: 'sourceId',
};

const getRepository = (
  con: DataSource | EntityManager,
  type: NotificationPreferenceType,
) => {
  switch (type) {
    case NotificationPreferenceType.Post:
      return con.getRepository(NotificationPreferencePost);
    case NotificationPreferenceType.Comment:
      return con.getRepository(NotificationPreferenceComment);
    case NotificationPreferenceType.Source:
      return con.getRepository(NotificationPreferenceSource);
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
  } catch (err) {
    if (err.code === TypeOrmError.FOREIGN_KEY) {
      throw new NotFoundError('Invalid reference id');
    }

    throw err;
  }
};
