import {
  UserState,
  UserStateKey,
  ReputationEvent,
  CommentMention,
} from '../../entity';
import { messageToJson, Worker } from '../worker';
import {
  Comment,
  CommentUpvote,
  COMMUNITY_PICKS_SOURCE,
  Feed,
  Post,
  Settings,
  SourceFeed,
  SourceMember,
  SourceRequest,
  Submission,
  SubmissionStatus,
  User,
  Feature,
  Source,
  PostMention,
  FreeformPost,
  Banner,
  PostType,
  FREEFORM_POST_MINIMUM_CONTENT_LENGTH,
  FREEFORM_POST_MINIMUM_CHANGE_LENGTH,
  UserPost,
  UserPostVote,
  PostRelation,
  PostRelationType,
  normalizeCollectionPostSources,
  CollectionPost,
} from '../../entity';
import {
  notifyCommentCommented,
  notifyCommentUpvoteCanceled,
  notifyCommentUpvoted,
  notifyPostBannedOrRemoved,
  notifyPostCommented,
  notifyPostReport,
  notifyCommentReport,
  notifyPostUpvoteCanceled,
  notifyPostUpvoted,
  notifySendAnalyticsReport,
  notifySourceFeedAdded,
  notifySourceFeedRemoved,
  notifySettingsUpdated,
  increaseReputation,
  decreaseReputation,
  notifySubmissionRejected,
  notifySubmissionGrantedAccess,
  NotificationReason,
  notifyUserDeleted,
  notifyUserUpdated,
  notifyUsernameChanged,
  notifyNewCommentMention,
  notifyMemberJoinedSource,
  notifyUserCreated,
  notifyFeatureAccess,
  notifySourcePrivacyUpdated,
  notifyPostVisible,
  notifySourceMemberRoleChanged,
  notifyNewPostMention,
  notifyContentRequested,
  notifyContentImageDeleted,
  notifyPostContentEdited,
  notifyCommentEdited,
  notifyCommentDeleted,
  notifyBannerCreated,
  notifyBannerRemoved,
  notifyFreeformContentRequested,
  notifySourceCreated,
  notifyPostYggdrasilIdSet,
  notifyPostCollectionUpdated,
  notifyUserReadmeUpdated,
  triggerTypedEvent,
  notifyReputationIncrease,
} from '../../common';
import { ChangeMessage } from '../../types';
import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { PostReport, ContentImage } from '../../entity';
import { reportReasons } from '../../schema/posts';
import { updateAlerts } from '../../schema/alerts';
import { submissionAccessThreshold } from '../../schema/submissions';
import { TypeOrmError } from '../../errors';
import { CommentReport } from '../../entity/CommentReport';
import { reportCommentReasons } from '../../schema/comments';
import { getTableName, isChanged } from './common';

const isFreeformPostLongEnough = (
  freeform: ChangeMessage<FreeformPost>,
): boolean =>
  freeform.payload.after.title.length + freeform.payload.after.content.length >=
  FREEFORM_POST_MINIMUM_CONTENT_LENGTH;

const isFreeformPostChangeLongEnough = (
  freeform: ChangeMessage<FreeformPost>,
): boolean =>
  Math.abs(
    freeform.payload.before.content.length -
      freeform.payload.after.content.length,
  ) >= FREEFORM_POST_MINIMUM_CHANGE_LENGTH;

const isCollectionUpdated = (
  collection: ChangeMessage<CollectionPost>,
): boolean =>
  collection.payload.before.summary !== collection.payload.after.summary ||
  collection.payload.before.content !== collection.payload.after.content;

const onSourceRequestChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<SourceRequest>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    // New source request
    await triggerTypedEvent(logger, 'pub-request', {
      reason: NotificationReason.New,
      sourceRequest: data.payload.after,
    });
  } else if (data.payload.op === 'u') {
    if (!data.payload.before.closed && data.payload.after.closed) {
      if (data.payload.after.approved) {
        // Source request published
        await triggerTypedEvent(logger, 'pub-request', {
          reason: NotificationReason.Publish,
          sourceRequest: data.payload.after,
        });
      } else {
        // Source request declined
        await triggerTypedEvent(logger, 'pub-request', {
          reason: NotificationReason.Decline,
          sourceRequest: data.payload.after,
        });
      }
    } else if (!data.payload.before.approved && data.payload.after.approved) {
      // Source request approved
      await triggerTypedEvent(logger, 'pub-request', {
        reason: NotificationReason.Approve,
        sourceRequest: data.payload.after,
      });
    }
  }
};

const onPostUpvoteChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<UserPost>,
): Promise<void> => {
  const isUpvote =
    data.payload.after?.vote === UserPostVote.Up ||
    data.payload.before?.vote === UserPostVote.Up;

  if (!isUpvote) {
    return;
  }

  switch (data.payload.op) {
    case 'c':
      await notifyPostUpvoted(
        logger,
        data.payload.after.postId,
        data.payload.after.userId,
      );

      break;
    case 'u': {
      const isUpvoteCanceled = data.payload.after.vote === UserPostVote.None;

      if (isUpvoteCanceled) {
        await notifyPostUpvoteCanceled(
          logger,
          data.payload.before.postId,
          data.payload.before.userId,
        );
      } else {
        await notifyPostUpvoted(
          logger,
          data.payload.after.postId,
          data.payload.after.userId,
        );
      }

      break;
    }
    case 'd': {
      const wasUpvoted = data.payload.before.vote === UserPostVote.Up;

      if (wasUpvoted) {
        await notifyPostUpvoteCanceled(
          logger,
          data.payload.before.postId,
          data.payload.before.userId,
        );
      }

      break;
    }
    default:
      break;
  }
};

const onCommentUpvoteChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<CommentUpvote>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    await notifyCommentUpvoted(
      logger,
      data.payload.after.commentId,
      data.payload.after.userId,
    );
  } else if (data.payload.op === 'd') {
    await notifyCommentUpvoteCanceled(
      logger,
      data.payload.before.commentId,
      data.payload.before.userId,
    );
  }
};

const onPostMentionChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<PostMention>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    await notifyNewPostMention(logger, data.payload.after);
  }
};

const onCommentMentionChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<CommentMention>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    await notifyNewCommentMention(logger, data.payload.after);
  }
};

const onCommentChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Comment>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    if (data.payload.after.parentId) {
      await notifyCommentCommented(
        logger,
        data.payload.after.postId,
        data.payload.after.userId,
        data.payload.after.parentId,
        data.payload.after.id,
      );
    } else {
      await notifyPostCommented(
        logger,
        data.payload.after.postId,
        data.payload.after.userId,
        data.payload.after.id,
      );
    }
  } else if (data.payload.op === 'u') {
    if (data.payload.before.contentHtml !== data.payload.after.contentHtml) {
      await notifyCommentEdited(logger, data.payload.after);
    }
  } else if (data.payload.op === 'd') {
    await notifyCommentDeleted(logger, data.payload.before);
  }
};

const onUserChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<User>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    await notifyUserCreated(logger, data.payload.after);
  } else if (data.payload.op === 'u') {
    await notifyUserUpdated(logger, data.payload.before, data.payload.after);
    if (
      data.payload.after.reputation >= submissionAccessThreshold &&
      data.payload.before.reputation < submissionAccessThreshold
    ) {
      try {
        await con.getRepository(UserState).insert({
          userId: data.payload.after.id,
          key: UserStateKey.CommunityLinkAccess,
          value: true,
        });
      } catch (ex) {
        if (ex.code !== TypeOrmError.DUPLICATE_ENTRY) {
          throw ex;
        }
      }
    }
    if (data.payload.after.reputation > data.payload.before.reputation) {
      await notifyReputationIncrease(
        logger,
        data.payload.before,
        data.payload.after,
      );
    }
    if (
      data.payload.before.infoConfirmed &&
      data.payload.before.username !== data.payload.after.username
    ) {
      await notifyUsernameChanged(
        logger,
        data.payload.before.id,
        data.payload.before.username,
        data.payload.after.username,
      );
    }
    if (data.payload.before.readme !== data.payload.after.readme) {
      await notifyUserReadmeUpdated(logger, data.payload.after);
    }
  }
  if (data.payload.op === 'd') {
    await notifyUserDeleted(
      logger,
      data.payload.before.id,
      true,
      data.payload.before.email,
    );
  }
};
const onSettingsChange = async (
  _: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Settings>,
): Promise<void> => {
  if (data.payload.op === 'u') {
    await notifySettingsUpdated(logger, data.payload.after);
  } else if (data.payload.op === 'c') {
    await notifySettingsUpdated(logger, data.payload.after);
  }
};

const onPostChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Post>,
): Promise<void> => {
  if (data.payload.after?.yggdrasilId && !data.payload.before?.yggdrasilId) {
    await notifyPostYggdrasilIdSet(logger, data.payload.after);
  }
  if (data.payload.op === 'c') {
    if (data.payload.after.visible) {
      await notifyPostVisible(logger, data.payload.after);
    }
    if (data.payload.after.type === PostType.Freeform) {
      const freeform = data as ChangeMessage<FreeformPost>;
      if (isFreeformPostLongEnough(freeform)) {
        await notifyFreeformContentRequested(logger, freeform);
      }
    }
  } else if (data.payload.op === 'u') {
    if (data.payload.after.visible) {
      if (!data.payload.before.visible) {
        await notifyPostVisible(logger, data.payload.after);
      } else {
        // Trigger message only if the post is already visible and the conte was edited
        const freeform = data as ChangeMessage<FreeformPost>;
        if (
          isChanged(freeform.payload.before, freeform.payload.after, 'content')
        ) {
          await notifyPostContentEdited(logger, data.payload.after);
        }
      }
    }

    if (data.payload.after.type === PostType.Collection) {
      const collection = data as ChangeMessage<CollectionPost>;
      if (isCollectionUpdated(collection)) {
        await notifyPostCollectionUpdated(logger, collection.payload.after);
      }
    }

    if (data.payload.after.type === PostType.Freeform) {
      const freeform = data as ChangeMessage<FreeformPost>;
      if (isFreeformPostChangeLongEnough(freeform)) {
        await notifyFreeformContentRequested(logger, freeform);
      }
    }

    if (
      !data.payload.before.sentAnalyticsReport &&
      data.payload.after.sentAnalyticsReport
    ) {
      await notifySendAnalyticsReport(logger, data.payload.after.id);
    }
    if (
      !data.payload.before.banned &&
      !data.payload.before.deleted &&
      (data.payload.after.banned || data.payload.after.deleted)
    ) {
      await notifyPostBannedOrRemoved(logger, data.payload.after);
    }
    if (
      isChanged(data.payload.before, data.payload.after, 'deleted') ||
      isChanged(data.payload.before, data.payload.after, 'banned') ||
      isChanged(data.payload.before, data.payload.after, 'tagsStr') ||
      isChanged(data.payload.before, data.payload.after, 'flags')
    ) {
      await con
        .getRepository(Post)
        .update(
          { id: data.payload.before.id },
          { metadataChangedAt: new Date() },
        );
    }
  }
};

const onPostReportChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<PostReport>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    const post = await con
      .getRepository(Post)
      .findOneBy({ id: data.payload.after.postId });
    if (post) {
      await notifyPostReport(
        data.payload.after.userId,
        post,
        reportReasons.get(data.payload.after.reason),
        data.payload.after.comment,
        data.payload.after.tags,
      );
    }
  }
};

const onCommentReportChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<CommentReport>,
) => {
  if (data.payload.op === 'c') {
    const comment = await con
      .getRepository(Comment)
      .findOneBy({ id: data.payload.after.commentId });
    if (comment) {
      await notifyCommentReport(
        data.payload.after.userId,
        comment,
        reportCommentReasons.get(data.payload.after.reason),
        data.payload.after.note,
      );
    }
  }
};

const onSourceFeedChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<SourceFeed>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    await notifySourceFeedAdded(
      logger,
      data.payload.after.sourceId,
      data.payload.after.feed,
    );
  } else if (data.payload.op === 'd') {
    await notifySourceFeedRemoved(
      logger,
      data.payload.before.sourceId,
      data.payload.before.feed,
    );
  }
};

const onBannerChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Banner>,
) => {
  if (data.payload.op === 'c') {
    await notifyBannerCreated(logger, data.payload.after);
  }
  if (data.payload.op === 'd') {
    await notifyBannerRemoved(logger, data.payload.before);
  }
};

const onSourceChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Source>,
) => {
  if (data.payload.op === 'c') {
    await notifySourceCreated(logger, data.payload.after);

    return;
  }

  if (data.payload.op === 'u') {
    // Temporary workaround to handle messages before replica identity full
    if (!data.payload.before) {
      return;
    }
    if (data.payload.before.private !== data.payload.after.private) {
      await notifySourcePrivacyUpdated(logger, data.payload.after);
    }
  }
};

const onFeedChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Feed>,
) => {
  if (data.payload.op === 'c') {
    await updateAlerts(con, data.payload.after.userId, { myFeed: 'created' });
  }
};

const onReputationEventChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<ReputationEvent>,
) => {
  if (data.payload.op === 'c') {
    const entity = data.payload.after;
    await increaseReputation(con, logger, entity.grantToId, entity.amount);
  } else if (data.payload.op === 'd') {
    const entity = data.payload.before;
    await decreaseReputation(con, logger, entity.grantToId, entity.amount);
  }
};

const onSubmissionChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Submission>,
) => {
  const entity = data.payload.after;
  if (data.payload.op === 'c') {
    await notifyContentRequested(logger, {
      url: entity.url,
      sourceId: COMMUNITY_PICKS_SOURCE,
      submissionId: entity.id,
    });
  } else if (data.payload.op === 'u') {
    if (entity.status === SubmissionStatus.Rejected) {
      await notifySubmissionRejected(logger, entity);
    }
  }
};

const onUserStateChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<UserState>,
) => {
  if (data.payload.op === 'c') {
    if (data.payload.after.key === UserStateKey.CommunityLinkAccess) {
      await notifySubmissionGrantedAccess(logger, data.payload.after.userId);
    }
  }
};

const onSourceMemberChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<SourceMember>,
) => {
  if (data.payload.op === 'c') {
    await notifyMemberJoinedSource(logger, data.payload.after);
  }
  if (data.payload.op === 'u') {
    if (data.payload.before.role !== data.payload.after.role) {
      await notifySourceMemberRoleChanged(
        logger,
        data.payload.before.role,
        data.payload.after,
      );
    }
  }
};

const onContentImageChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<ContentImage>,
) => {
  if (data.payload.op === 'd') {
    await notifyContentImageDeleted(logger, data.payload.before);
  }
};

const onFeatureChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Feature>,
) => {
  if (data.payload.op === 'c') {
    await notifyFeatureAccess(logger, data.payload.after);
  }
};

const onPostRelationChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<PostRelation>,
) => {
  if (data.payload.op === 'c') {
    if (data.payload.after.type === PostRelationType.Collection) {
      await normalizeCollectionPostSources({
        con,
        postId: data.payload.after.postId,
      });
    }
  }
};

const worker: Worker = {
  subscription: 'api-cdc',
  maxMessages: parseInt(process.env.CDC_WORKER_MAX_MESSAGES) || null,
  handler: async (message, con, logger): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: ChangeMessage<any> = messageToJson(message);
      if (
        data.schema.name === 'io.debezium.connector.common.Heartbeat' ||
        data.payload.op === 'r'
      ) {
        return;
      }
      switch (data.payload.source.table) {
        case getTableName(con, Banner):
          await onBannerChange(con, logger, data);
          break;
        case getTableName(con, Source):
          await onSourceChange(con, logger, data);
          break;
        case getTableName(con, Feed):
          await onFeedChange(con, logger, data);
          break;
        case getTableName(con, SourceRequest):
          await onSourceRequestChange(con, logger, data);
          break;
        case getTableName(con, UserPost):
          await onPostUpvoteChange(con, logger, data);
          break;
        case getTableName(con, CommentUpvote):
          await onCommentUpvoteChange(con, logger, data);
          break;
        case getTableName(con, CommentMention):
          await onCommentMentionChange(con, logger, data);
          break;
        case getTableName(con, PostMention):
          await onPostMentionChange(con, logger, data);
          break;
        case getTableName(con, Comment):
          await onCommentChange(con, logger, data);
          break;
        case getTableName(con, User):
          await onUserChange(con, logger, data);
          break;
        case getTableName(con, Post):
          await onPostChange(con, logger, data);
          break;
        case getTableName(con, PostReport):
          await onPostReportChange(con, logger, data);
          break;
        case getTableName(con, CommentReport):
          await onCommentReportChange(con, logger, data);
          break;
        case getTableName(con, SourceFeed):
          await onSourceFeedChange(con, logger, data);
          break;
        case getTableName(con, Settings):
          await onSettingsChange(con, logger, data);
          break;
        case getTableName(con, ReputationEvent):
          await onReputationEventChange(con, logger, data);
          break;
        case getTableName(con, Submission):
          await onSubmissionChange(con, logger, data);
          break;
        case getTableName(con, UserState):
          await onUserStateChange(con, logger, data);
          break;
        case getTableName(con, SourceMember):
          await onSourceMemberChange(con, logger, data);
          break;
        case getTableName(con, Feature):
          await onFeatureChange(con, logger, data);
          break;
        case getTableName(con, ContentImage):
          await onContentImageChange(con, logger, data);
          break;
        case getTableName(con, PostRelation):
          await onPostRelationChange(con, logger, data);
          break;
      }
    } catch (err) {
      logger.error(
        {
          messageId: message.messageId,
          err,
        },
        'failed to handle cdc message',
      );
      throw err;
    }
  },
};

export default worker;
