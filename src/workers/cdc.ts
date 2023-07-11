import { UserState, UserStateKey } from './../entity/UserState';
import { ReputationEvent } from './../entity/ReputationEvent';
import { CommentMention } from './../entity/CommentMention';
import { messageToJson, Worker } from './worker';
import {
  Comment,
  CommentUpvote,
  COMMUNITY_PICKS_SOURCE,
  Feed,
  Notification,
  Post,
  Settings,
  SourceFeed,
  SourceMember,
  SourceRequest,
  Submission,
  SubmissionStatus,
  Upvote,
  User,
  Feature,
  Source,
  PostMention,
  FreeformPost,
} from '../entity';
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
  notifyAlertsUpdated,
  notifySourceFeedAdded,
  notifySourceFeedRemoved,
  notifySourceRequest,
  notifySettingsUpdated,
  increaseReputation,
  decreaseReputation,
  notifySubmissionRejected,
  notifySubmissionGrantedAccess,
  NotificationReason,
  notifyUserDeleted,
  notifyUserUpdated,
  notifyUsernameChanged,
  notifyNewNotification,
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
} from '../common';
import { ChangeMessage } from '../types';
import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { PostReport, Alerts, ContentImage } from '../entity';
import { reportReasons } from '../schema/posts';
import { updateAlerts } from '../schema/alerts';
import { submissionAccessThreshold } from '../schema/submissions';
import { TypeOrmError } from '../errors';
import { CommentReport } from '../entity/CommentReport';
import { reportCommentReasons } from '../schema/comments';

const isChanged = <T>(before: T, after: T, property: keyof T): boolean =>
  before[property] != after[property];

const onSourceRequestChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<SourceRequest>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    // New source request
    await notifySourceRequest(
      logger,
      NotificationReason.New,
      data.payload.after,
    );
  } else if (data.payload.op === 'u') {
    if (!data.payload.before.closed && data.payload.after.closed) {
      if (data.payload.after.approved) {
        // Source request published
        await notifySourceRequest(
          logger,
          NotificationReason.Publish,
          data.payload.after,
        );
      } else {
        // Source request declined
        await notifySourceRequest(
          logger,
          NotificationReason.Decline,
          data.payload.after,
        );
      }
    } else if (!data.payload.before.approved && data.payload.after.approved) {
      // Source request approved
      await notifySourceRequest(
        logger,
        NotificationReason.Approve,
        data.payload.after,
      );
    }
  }
};

const onPostUpvoteChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Upvote>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    await notifyPostUpvoted(
      logger,
      data.payload.after.postId,
      data.payload.after.userId,
    );
  } else if (data.payload.op === 'd') {
    await notifyPostUpvoteCanceled(
      logger,
      data.payload.before.postId,
      data.payload.before.userId,
    );
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
  }
  if (data.payload.op === 'd') {
    await notifyUserDeleted(logger, data.payload.before.id, true);
  }
};

const onAlertsChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Alerts>,
): Promise<void> => {
  if (data.payload.op === 'u') {
    await notifyAlertsUpdated(logger, data.payload.after);
  } else if (data.payload.op === 'c') {
    await notifyAlertsUpdated(logger, data.payload.after);
  }
};

const onNotificationsChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Notification>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    await notifyNewNotification(logger, data.payload.after);
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
  if (data.payload.op === 'c') {
    if (data.payload.after.visible) {
      await notifyPostVisible(logger, data.payload.after);
    }
  } else if (data.payload.op === 'u') {
    if (data.payload.after.visible) {
      if (!data.payload.before.visible) {
        await notifyPostVisible(logger, data.payload.after);
      } else {
        // Trigger message only if the post is already visible and the conte was edited
        const freeform = data as unknown as ChangeMessage<FreeformPost>;
        if (
          isChanged(freeform.payload.before, freeform.payload.after, 'content')
        ) {
          await notifyPostContentEdited(logger, data.payload.after);
        }
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
      isChanged(data.payload.before, data.payload.after, 'tagsStr')
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

const onSourceChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<Source>,
) => {
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

const getTableName = <Entity>(
  con: DataSource,
  target: EntityTarget<Entity>,
): string => con.getRepository(target).metadata.tableName;

const worker: Worker = {
  subscription: 'api-cdc',
  maxMessages: parseInt(process.env.CDC_WORKER_MAX_MESSAGES) || null,
  handler: async (message, con, logger): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: ChangeMessage<any> = messageToJson(message);
      if (data.schema.name === 'io.debezium.connector.common.Heartbeat') {
        return;
      }
      switch (data.payload.source.table) {
        case getTableName(con, Source):
          await onSourceChange(con, logger, data);
          break;
        case getTableName(con, Feed):
          await onFeedChange(con, logger, data);
          break;
        case getTableName(con, SourceRequest):
          await onSourceRequestChange(con, logger, data);
          break;
        case getTableName(con, Upvote):
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
        case getTableName(con, Alerts):
          await onAlertsChange(con, logger, data);
          break;
        case getTableName(con, Notification):
          await onNotificationsChange(con, logger, data);
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
