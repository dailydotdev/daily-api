import { PubSub, Topic } from '@google-cloud/pubsub';
import { FastifyBaseLogger } from 'fastify';
import {
  Post,
  Settings,
  Submission,
  User,
  CommentMention,
  SourceMember,
  Feature,
  Source,
  ArticlePost,
  PostMention,
  Comment,
  ContentImage,
  Banner,
  FreeformPost,
  CollectionPost,
  NotificationV2,
  UserPersonalizedDigest,
} from '../entity';
import { ChangeMessage, ChangeObject } from '../types';
import { SourceMemberRoles } from '../roles';
import {
  addPubsubSpanLabels,
  opentelemetry,
  runInRootSpan,
  runInSpan,
} from '../telemetry/opentelemetry';
import { Message } from '@google-cloud/pubsub';
// import { performance } from 'perf_hooks';
import { DataSource } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import pino from 'pino';
import { PersonalizedDigestFeatureConfig } from '../growthbook';

export const pubsub = new PubSub();
const postUpvotedTopic = pubsub.topic('post-upvoted');
const postUpvoteCanceledTopic = pubsub.topic('post-upvote-canceled');
const postDownvotedTopic = pubsub.topic('api.v1.post-downvoted');
const postDownvoteCanceledTopic = pubsub.topic('api.v1.post-downvote-canceled');
const commentUpvotedTopic = pubsub.topic('comment-upvoted');
const postCommentedTopic = pubsub.topic('post-commented');
const commentCommentedTopic = pubsub.topic('comment-commented');
const commentFeaturedTopic = pubsub.topic('comment-featured');
const commentsUpdateTopic = pubsub.topic('update-comments');
const userDeletedTopic = pubsub.topic('user-deleted');
const userUpdatedTopic = pubsub.topic('user-updated');
const usernameChangedTopic = pubsub.topic('username-changed');
const settingsUpdatedTopic = pubsub.topic('settings-updated');
const commentUpvoteCanceledTopic = pubsub.topic('comment-upvote-canceled');
const sendAnalyticsReportTopic = pubsub.topic('send-analytics-report');
const viewsTopic = pubsub.topic('views');
const postBannedOrRemovedTopic = pubsub.topic('post-banned-or-removed');
const sourceFeedAddedTopic = pubsub.topic('source-feed-added');
const sourceFeedRemovedTopic = pubsub.topic('source-feed-removed');
const communityLinkAccessTopic = pubsub.topic('community-link-access');
const communityLinkRejectedTopic = pubsub.topic('community-link-rejected');
const newNotificationTopic = pubsub.topic('api.v1.new-notification');
const newPostMentionTopic = pubsub.topic('api.v1.new-post-mention');
const newCommentMentionTopic = pubsub.topic('api.v1.new-comment-mention');
const memberJoinedSourceTopic = pubsub.topic('api.v1.member-joined-source');
const featureAccess = pubsub.topic('api.v1.feature-granted');
const userCreatedTopic = pubsub.topic('api.v1.user-created');
const sourcePrivacyUpdatedTopic = pubsub.topic('api.v1.source-privacy-updated');
const featuresResetTopic = pubsub.topic('features-reset');
const contentRequestedTopic = pubsub.topic('api.v1.content-requested');
const postVisibleTopic = pubsub.topic('api.v1.post-visible');
const bannerAddedTopic = pubsub.topic('api.v1.banner-added');
const bannerRemovedTopic = pubsub.topic('api.v1.banner-deleted');
const sourceMemberRoleChangedTopic = pubsub.topic(
  'api.v1.source-member-role-changed',
);
const contentImageDeletedTopic = pubsub.topic('api.v1.content-image-deleted');
const postContentEditedTopic = pubsub.topic('api.v1.post-content-edited');
const commentEditedTopic = pubsub.topic('api.v1.comment-edited');
const commentDeletedTopic = pubsub.topic('api.v1.comment-deleted');
const sourceCreatedTopic = pubsub.topic('api.v1.source-created');
const generatePersonalizedDigestTopic = pubsub.topic(
  'api.v1.generate-personalized-digest',
);
const postYggdrasilIdSet = pubsub.topic('api.v1.post-yggdrasil-id-set');
const postCollectionUpdatedTopic = pubsub.topic(
  'api.v1.post-collection-updated',
);
const userReadmeUpdatedTopic = pubsub.topic('api.v1.user-readme-updated');
const userReputatioUpdatedTopic = pubsub.topic('user-reputation-updated');
const commentDownvotedTopic = pubsub.topic('api.v1.comment-downvoted');
const commentDownvoteCanceledTopic = pubsub.topic(
  'api.v1.comment-downvote-canceled',
);

export enum NotificationReason {
  New = 'new',
  Publish = 'publish',
  Approve = 'approve',
  Decline = 'decline',
  Exists = 'exists',
}

// Need to support console as well
export type EventLogger = Omit<FastifyBaseLogger, 'fatal'>;

export const publishEvent = async (
  log: EventLogger,
  topic: Topic,
  payload: Record<string, unknown>,
): Promise<void> =>
  runInSpan(
    `publishEvent ${topic.name}`,
    async () => {
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
    },
    {
      kind: opentelemetry.SpanKind.PRODUCER,
    },
  );

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

export const notifyPostDownvoted = async (
  log: EventLogger,
  postId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, postDownvotedTopic, {
    postId,
    userId,
  });

export const notifyPostDownvoteCanceled = async (
  log: EventLogger,
  postId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, postDownvoteCanceledTopic, {
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
  email: string,
): Promise<void> =>
  publishEvent(log, userDeletedTopic, {
    id: userId,
    kratosUser,
    email,
  });

export const notifyUserUpdated = (
  log: EventLogger,
  user: ChangeObject<User>,
  newProfile: ChangeObject<User>,
): Promise<void> => publishEvent(log, userUpdatedTopic, { user, newProfile });

export const notifyUserReadmeUpdated = (
  log: EventLogger,
  user: ChangeObject<User>,
): Promise<void> => publishEvent(log, userReadmeUpdatedTopic, { user });

export const notifyUsernameChanged = (
  log: EventLogger,
  userId: string,
  oldUsername: string,
  newUsername: string,
): Promise<void> =>
  publishEvent(log, usernameChangedTopic, { userId, oldUsername, newUsername });

export const notifySettingsUpdated = (
  log: EventLogger,
  settings: ChangeObject<Settings>,
): Promise<void> => publishEvent(log, settingsUpdatedTopic, settings);

export const notifySourcePrivacyUpdated = (
  log: EventLogger,
  source: ChangeObject<Source>,
): Promise<void> => publishEvent(log, sourcePrivacyUpdatedTopic, { source });

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

export const notifySubmissionGrantedAccess = async (
  log: EventLogger,
  userId: string,
): Promise<void> => publishEvent(log, communityLinkAccessTopic, { userId });

export const notifySourceMemberRoleChanged = async (
  log: EventLogger,
  previousRole: SourceMemberRoles,
  sourceMember: ChangeObject<SourceMember>,
): Promise<void> =>
  publishEvent(log, sourceMemberRoleChangedTopic, {
    previousRole,
    sourceMember,
  });

export const notifyNewNotification = async (
  log: EventLogger,
  notification: ChangeObject<NotificationV2>,
): Promise<void> => publishEvent(log, newNotificationTopic, { notification });

export const notifyNewPostMention = async (
  log: EventLogger,
  postMention: ChangeObject<PostMention>,
): Promise<void> => publishEvent(log, newPostMentionTopic, { postMention });

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

export const notifyPostVisible = async (
  log: EventLogger,
  post: ChangeObject<Post>,
): Promise<void> => publishEvent(log, postVisibleTopic, { post });

export const notifyBannerCreated = async (
  log: EventLogger,
  banner: ChangeObject<Banner>,
): Promise<void> => publishEvent(log, bannerAddedTopic, { banner });

export const notifyBannerRemoved = async (
  log: EventLogger,
  banner: ChangeObject<Banner>,
): Promise<void> => publishEvent(log, bannerRemovedTopic, { banner });

export const notifyUserCreated = async (
  log: EventLogger,
  user: ChangeObject<User>,
): Promise<void> =>
  publishEvent(log, userCreatedTopic, {
    user,
  });

export const notifyFeaturesReset = async (log: EventLogger): Promise<void> =>
  publishEvent(log, featuresResetTopic, {});

type ContentRequestedSubmission = { submissionId: string } & Pick<
  ArticlePost,
  'sourceId' | 'url'
>;
type ContentRequestedURL = Pick<ArticlePost, 'id' | 'origin' | 'url'>;
type ContentRequestedFreeForm = Pick<
  FreeformPost,
  'id' | 'content' | 'title'
> & {
  post_type;
};
export type ContentRequested =
  | ContentRequestedSubmission
  | ContentRequestedURL
  | ContentRequestedFreeForm;

export const notifyContentRequested = async (
  log: EventLogger,
  content: ContentRequested,
): Promise<void> => publishEvent(log, contentRequestedTopic, content);

export const notifyFreeformContentRequested = async (
  logger: EventLogger,
  freeform: ChangeMessage<FreeformPost>,
): Promise<void> =>
  notifyContentRequested(logger, {
    id: freeform.payload.after.id,
    content: freeform.payload.after.content,
    title: freeform.payload.after.title,
    post_type: freeform.payload.after.type,
  });

export const notifyContentImageDeleted = async (
  log: EventLogger,
  contentImage: ChangeObject<ContentImage>,
): Promise<void> =>
  publishEvent(log, contentImageDeletedTopic, { contentImage });

export const notifyPostContentEdited = async (
  log: EventLogger,
  post: ChangeObject<Post>,
): Promise<void> => publishEvent(log, postContentEditedTopic, { post });

export const notifyCommentEdited = async (
  log: EventLogger,
  comment: ChangeObject<Comment>,
): Promise<void> => publishEvent(log, commentEditedTopic, { comment });

export const notifyCommentDeleted = async (
  log: EventLogger,
  comment: ChangeObject<Comment>,
): Promise<void> => publishEvent(log, commentDeletedTopic, { comment });

export const notifySourceCreated = async (
  log: EventLogger,
  source: ChangeObject<Source>,
): Promise<void> => publishEvent(log, sourceCreatedTopic, { source });

export const notifyGeneratePersonalizedDigest = async ({
  log,
  personalizedDigest,
  emailSendTimestamp,
  previousSendTimestamp,
  emailBatchId,
  deduplicate,
  config,
}: {
  log: EventLogger;
  personalizedDigest: UserPersonalizedDigest;
  emailSendTimestamp: number;
  previousSendTimestamp: number;
  emailBatchId?: string;
  deduplicate?: boolean;
  config?: PersonalizedDigestFeatureConfig;
}): Promise<void> =>
  publishEvent(log, generatePersonalizedDigestTopic, {
    personalizedDigest,
    emailSendTimestamp,
    previousSendTimestamp,
    emailBatchId,
    deduplicate: deduplicate ?? true,
    config,
  });

export const notifyPostYggdrasilIdSet = async (
  log: EventLogger,
  post: ChangeObject<Post>,
): Promise<void> =>
  publishEvent(log, postYggdrasilIdSet, {
    post,
  });

export const notifyPostCollectionUpdated = async (
  log: EventLogger,
  post: ChangeObject<CollectionPost>,
): Promise<void> => publishEvent(log, postCollectionUpdatedTopic, { post });

export const notifyReputationIncrease = async (
  log: EventLogger,
  user: ChangeObject<User>,
  userAfter: ChangeObject<User>,
): Promise<void> =>
  publishEvent(log, userReputatioUpdatedTopic, {
    user,
    userAfter,
  });

export const notifyCommentDownvoted = async (
  log: EventLogger,
  commentId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, commentDownvotedTopic, {
    commentId,
    userId,
  });

export const notifyCommentDownvoteCanceled = async (
  log: EventLogger,
  commentId: string,
  userId: string,
): Promise<void> =>
  publishEvent(log, commentDownvoteCanceledTopic, {
    commentId,
    userId,
  });

export const workerSubscribe = (
  logger: pino.Logger,
  pubsub: PubSub,
  connection: DataSource,
  subscription: string,
  meter: opentelemetry.Meter,
  handler: (
    message: Message,
    con: DataSource,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
  ) => Promise<void>,
  maxMessages = 1,
): void => {
  logger.info(`subscribing to ${subscription}`);
  const sub = pubsub.subscription(subscription, {
    flowControl: {
      maxMessages,
    },
    batching: { maxMilliseconds: 10 },
  });
  const childLogger = logger.child({ subscription });
  // const histogram = meter.createHistogram('message_processing_time', {
  //   unit: 'ms',
  //   description: 'time to process a message',
  // });
  sub.on('message', async (message) =>
    runInRootSpan(
      `message: ${subscription}`,
      async (span) => {
        // const startTime = performance.now();
        // let success = true;
        addPubsubSpanLabels(span, subscription, message);
        try {
          await runInSpan('handler', async () =>
            handler(message, connection, childLogger, pubsub),
          );
          message.ack();
        } catch (err) {
          // success = false;
          childLogger.error(
            {
              messageId: message.id,
              data: message.data.toString('utf-8'),
              err,
            },
            'failed to process message',
          );
          message.nack();
        }
        // histogram.record(performance.now() - startTime, {
        //   subscription,
        //   success,
        // });
      },
      {
        kind: opentelemetry.SpanKind.CONSUMER,
      },
    ),
  );
};
