import { PubSub, Topic } from '@google-cloud/pubsub';
import { FastifyLoggerInstance } from 'fastify';
import {
  Post,
  SourceRequest,
  Alerts,
  Settings,
  Submission,
  User,
  Notification,
  CommentMention,
  SourceMember,
  Feature,
  Source,
  ArticlePost,
} from '../entity';
import { ChangeObject } from '../types';

const pubsub = new PubSub();
const sourceRequestTopic = pubsub.topic('pub-request');
const postUpvotedTopic = pubsub.topic('post-upvoted');
const postUpvoteCanceledTopic = pubsub.topic('post-upvote-canceled');
const commentUpvotedTopic = pubsub.topic('comment-upvoted');
const postCommentedTopic = pubsub.topic('post-commented');
const commentCommentedTopic = pubsub.topic('comment-commented');
const commentFeaturedTopic = pubsub.topic('comment-featured');
const commentsUpdateTopic = pubsub.topic('update-comments');
const userDeletedTopic = pubsub.topic('user-deleted');
const userUpdatedTopic = pubsub.topic('user-updated');
const usernameChangedTopic = pubsub.topic('username-changed');
const alertsUpdatedTopic = pubsub.topic('alerts-updated');
const settingsUpdatedTopic = pubsub.topic('settings-updated');
const notificationsReadTopic = pubsub.topic('api.v1.notifications-read');
const commentUpvoteCanceledTopic = pubsub.topic('comment-upvote-canceled');
const sendAnalyticsReportTopic = pubsub.topic('send-analytics-report');
const viewsTopic = pubsub.topic('views');
const postBannedOrRemovedTopic = pubsub.topic('post-banned-or-removed');
const sourceFeedAddedTopic = pubsub.topic('source-feed-added');
const sourceFeedRemovedTopic = pubsub.topic('source-feed-removed');
const communityLinkAccessTopic = pubsub.topic('community-link-access');
const communityLinkRejectedTopic = pubsub.topic('community-link-rejected');
const communityLinkSubmittedTopic = pubsub.topic('community-link-submitted');
const newNotificationTopic = pubsub.topic('api.v1.new-notification');
const newCommentMentionTopic = pubsub.topic('api.v1.new-comment-mention');
const memberJoinedSourceTopic = pubsub.topic('api.v1.member-joined-source');
const featureAccess = pubsub.topic('api.v1.feature-granted');
const postAddedTopic = pubsub.topic('api.v1.post-added');
const userCreatedTopic = pubsub.topic('api.v1.user-created');
const sourcePrivacyUpdatedTopic = pubsub.topic('api.v1.source-privacy-updated');
const featuresResetTopic = pubsub.topic('features-reset');
const contentRequestedTopic = pubsub.topic('api.v1.content-requested');

export enum NotificationReason {
  New = 'new',
  Publish = 'publish',
  Approve = 'approve',
  Decline = 'decline',
  Exists = 'exists',
}

// Need to support console as well
export type EventLogger = Omit<FastifyLoggerInstance, 'fatal'>;

const publishEvent = async (
  log: EventLogger,
  topic: Topic,
  payload: Record<string, unknown>,
): Promise<void> => {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ENABLE_PUBSUB === 'true'
  ) {
    try {
      await topic.publishMessage({
        json: payload,
      });
    } catch (err) {
      log.error(
        { err, topic: topic.name, payload },
        'failed to publish message',
      );
    }
  }
};

export const notifySourceRequest = async (
  log: EventLogger,
  reason: NotificationReason,
  sourceRequest: ChangeObject<SourceRequest>,
): Promise<void> =>
  publishEvent(log, sourceRequestTopic, {
    reason,
    sourceRequest,
  });

export const notifyPostUpvoted = async (
  log: EventLogger,
  postId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, postUpvotedTopic, {
    postId,
    userId,
  });

export const notifyPostUpvoteCanceled = async (
  log: EventLogger,
  postId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, postUpvoteCanceledTopic, {
    postId,
    userId,
  });

export const notifyCommentUpvoted = async (
  log: EventLogger,
  commentId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, commentUpvotedTopic, {
    commentId,
    userId,
  });

export const notifyPostCommented = async (
  log: EventLogger,
  postId: string,
  userId: string,
  commentId: string,
): Promise<void> =>
  publishEvent(log, postCommentedTopic, {
    postId,
    userId,
    commentId,
  });

export const notifyCommentCommented = async (
  log: EventLogger,
  postId: string,
  userId: string,
  parentCommentId: string,
  childCommentId: string,
): Promise<void> =>
  publishEvent(log, commentCommentedTopic, {
    postId,
    userId,
    parentCommentId,
    childCommentId,
  });

export const notifyCommentFeatured = async (
  log: EventLogger,
  commentId: string,
): Promise<void> =>
  publishEvent(log, commentFeaturedTopic, {
    commentId,
  });

export const notifyCommentsUpdate = async (
  log: EventLogger,
  oldUsername: string,
  newUsername: string,
  commentIds: string[],
): Promise<void> =>
  publishEvent(log, commentsUpdateTopic, {
    oldUsername,
    newUsername,
    commentIds,
  });

export const notifyUserDeleted = async (
  log: EventLogger,
  userId: string,
  kratosUser = false,
): Promise<void> =>
  publishEvent(log, userDeletedTopic, {
    id: userId,
    kratosUser,
  });

export const notifyUserUpdated = (
  log: EventLogger,
  user: ChangeObject<User>,
  newProfile: ChangeObject<User>,
): Promise<void> => publishEvent(log, userUpdatedTopic, { user, newProfile });

export const notifyUsernameChanged = (
  log: EventLogger,
  userId: string,
  oldUsername: string,
  newUsername: string,
): Promise<void> =>
  publishEvent(log, usernameChangedTopic, { userId, oldUsername, newUsername });

export const notifyAlertsUpdated = (
  log: EventLogger,
  alerts: ChangeObject<Alerts>,
): Promise<void> => publishEvent(log, alertsUpdatedTopic, alerts);

export const notifySettingsUpdated = (
  log: EventLogger,
  settings: ChangeObject<Settings>,
): Promise<void> => publishEvent(log, settingsUpdatedTopic, settings);

export const notifySourcePrivacyUpdated = (
  log: EventLogger,
  source: ChangeObject<Source>,
): Promise<void> => publishEvent(log, sourcePrivacyUpdatedTopic, { source });

export const notifyNotificationsRead = (
  log: EventLogger,
  unreadNotificationsCount: ChangeObject<{ unreadNotificationsCount: number }>,
): Promise<void> =>
  publishEvent(log, notificationsReadTopic, unreadNotificationsCount);

export const notifyCommentUpvoteCanceled = async (
  log: EventLogger,
  commentId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, commentUpvoteCanceledTopic, {
    commentId,
    userId,
  });

export const notifySendAnalyticsReport = async (
  log: EventLogger,
  postId: string,
): Promise<void> =>
  publishEvent(log, sendAnalyticsReportTopic, {
    postId,
  });

export const notifyView = (
  log: EventLogger,
  postId: string,
  userId: string,
  referer: string,
  timestamp: Date,
  tags?: string[],
): Promise<void> =>
  publishEvent(log, viewsTopic, {
    postId,
    userId,
    referer,
    timestamp,
    tags,
  });

export const notifyPostBannedOrRemoved = async (
  log: EventLogger,
  post: ChangeObject<Post>,
): Promise<void> =>
  publishEvent(log, postBannedOrRemovedTopic, {
    post,
  });

export const notifySourceFeedAdded = async (
  log: EventLogger,
  sourceId: string,
  feed: string,
): Promise<void> =>
  publishEvent(log, sourceFeedAddedTopic, {
    feed,
    sourceId,
  });

export const notifySourceFeedRemoved = async (
  log: EventLogger,
  sourceId: string,
  feed: string,
): Promise<void> =>
  publishEvent(log, sourceFeedRemovedTopic, {
    feed,
    sourceId,
  });

export const notifySubmissionRejected = async (
  log: EventLogger,
  submission: ChangeObject<Submission>,
): Promise<void> => publishEvent(log, communityLinkRejectedTopic, submission);

interface NewSubmission {
  sourceId: string;
  url: string;
  submissionId: string;
}

export const notifySubmissionCreated = async (
  log: EventLogger,
  submission: ChangeObject<NewSubmission>,
): Promise<void> => publishEvent(log, communityLinkSubmittedTopic, submission);

export const notifySubmissionGrantedAccess = async (
  log: EventLogger,
  userId: string,
): Promise<void> => publishEvent(log, communityLinkAccessTopic, { userId });

export const notifyNewNotification = async (
  log: EventLogger,
  notification: ChangeObject<Notification>,
): Promise<void> => publishEvent(log, newNotificationTopic, { notification });

export const notifyNewCommentMention = async (
  log: EventLogger,
  commentMention: ChangeObject<CommentMention>,
): Promise<void> =>
  publishEvent(log, newCommentMentionTopic, { commentMention });

export const notifyMemberJoinedSource = async (
  log: EventLogger,
  sourceMember: ChangeObject<SourceMember>,
): Promise<void> =>
  publishEvent(log, memberJoinedSourceTopic, { sourceMember });

export const notifyFeatureAccess = async (
  log: EventLogger,
  feature: ChangeObject<Feature>,
): Promise<void> => publishEvent(log, featureAccess, { feature });

export const notifyPostAdded = async (
  log: EventLogger,
  post: ChangeObject<Post>,
): Promise<void> => publishEvent(log, postAddedTopic, { post });

export const notifyUserCreated = async (
  log: EventLogger,
  user: ChangeObject<User>,
): Promise<void> =>
  publishEvent(log, userCreatedTopic, {
    user,
  });

export const notifyFeaturesReset = async (log: EventLogger): Promise<void> =>
  publishEvent(log, featuresResetTopic, {});

export type ContentRequested = Pick<ArticlePost, 'id' | 'url' | 'origin'>;

export const notifyContentRequested = async (
  log: EventLogger,
  content: ChangeObject<ContentRequested>,
): Promise<void> => publishEvent(log, contentRequestedTopic, { ...content });
