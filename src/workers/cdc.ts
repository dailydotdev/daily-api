import { messageToJson, Worker } from './worker';
import {
  Comment,
  CommentUpvote,
  Post,
  Settings,
  SourceFeed,
  SourceRequest,
  Upvote,
  User,
} from '../entity';
import {
  notifyCommentCommented,
  notifyCommentUpvoteCanceled,
  notifyCommentUpvoted,
  notifyDevCardEligible,
  notifyPostAuthorMatched,
  notifyPostBannedOrRemoved,
  notifyPostCommented,
  notifyPostReachedViewsThreshold,
  notifyPostReport,
  notifyPostUpvoteCanceled,
  notifyPostUpvoted,
  notifySendAnalyticsReport,
  notifyAlertsUpdated,
  notifySourceFeedAdded,
  notifySourceFeedRemoved,
  notifySourceRequest,
  notifySettingsUpdated,
  notifyUserReputationUpdated,
  notifyNewComment,
} from '../common';
import { ChangeMessage } from '../types';
import { Connection } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { viewsThresholds } from '../cron/viewsThreshold';
import { PostReport, Alerts } from '../entity';
import { reportReasons } from '../schema/posts';

const isChanged = <T>(before: T, after: T, property: keyof T): boolean =>
  before[property] != after[property];

const onSourceRequestChange = async (
  con: Connection,
  logger: FastifyLoggerInstance,
  data: ChangeMessage<SourceRequest>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    // New source request
    await notifySourceRequest(logger, 'new', data.payload.after);
  } else if (data.payload.op === 'u') {
    if (!data.payload.before.closed && data.payload.after.closed) {
      if (data.payload.after.approved) {
        // Source request published
        await notifySourceRequest(logger, 'publish', data.payload.after);
      } else {
        // Source request declined
        await notifySourceRequest(logger, 'decline', data.payload.after);
      }
    } else if (!data.payload.before.approved && data.payload.after.approved) {
      // Source request approved
      await notifySourceRequest(logger, 'approve', data.payload.after);
    }
  }
};

const onPostUpvoteChange = async (
  con: Connection,
  logger: FastifyLoggerInstance,
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
  con: Connection,
  logger: FastifyLoggerInstance,
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

const onCommentChange = async (
  con: Connection,
  logger: FastifyLoggerInstance,
  data: ChangeMessage<Comment>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    const post = await con
      .getRepository(Post)
      .findOne(data.payload.after.postId);
    if (post) {
      await notifyNewComment(
        data.payload.after.userId,
        post,
        data.payload.after.content,
      );
    }
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
  }
};

const onUserChange = async (
  con: Connection,
  logger: FastifyLoggerInstance,
  data: ChangeMessage<User>,
): Promise<void> => {
  if (data.payload.op === 'u') {
    if (data.payload.before.reputation !== data.payload.after.reputation) {
      await notifyUserReputationUpdated(
        logger,
        data.payload.after.id,
        data.payload.after.reputation,
      );
    }
    if (
      !data.payload.before.devcardEligible &&
      data.payload.after.devcardEligible
    ) {
      await notifyDevCardEligible(logger, data.payload.after.id);
    }
  }
};

const onAlertsChange = async (
  con: Connection,
  logger: FastifyLoggerInstance,
  data: ChangeMessage<Alerts>,
): Promise<void> => {
  if (data.payload.op === 'u') {
    await notifyAlertsUpdated(logger, data.payload.after);
  } else if (data.payload.op === 'c') {
    await notifyAlertsUpdated(logger, data.payload.after);
  }
};

const onSettingsChange = async (
  _: Connection,
  logger: FastifyLoggerInstance,
  data: ChangeMessage<Settings>,
): Promise<void> => {
  if (data.payload.op === 'u') {
    await notifySettingsUpdated(logger, data.payload.after);
  } else if (data.payload.op === 'c') {
    await notifySettingsUpdated(logger, data.payload.after);
  }
};

const onPostChange = async (
  con: Connection,
  logger: FastifyLoggerInstance,
  data: ChangeMessage<Post>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    if (data.payload.after.authorId) {
      await notifyPostAuthorMatched(
        logger,
        data.payload.after.id,
        data.payload.after.authorId,
      );
    }
  } else if (data.payload.op === 'u') {
    if (
      !data.payload.before.sentAnalyticsReport &&
      data.payload.after.sentAnalyticsReport
    ) {
      await notifySendAnalyticsReport(logger, data.payload.after.id);
    }
    if (
      data.payload.before.viewsThreshold !== data.payload.after.viewsThreshold
    ) {
      await notifyPostReachedViewsThreshold(
        logger,
        data.payload.after.id,
        viewsThresholds[data.payload.after.viewsThreshold - 1],
      );
    }
    if (
      !data.payload.before.banned &&
      !data.payload.before.deleted &&
      (data.payload.after.banned || data.payload.after.deleted)
    ) {
      await notifyPostBannedOrRemoved(logger, data.payload.after);
    }
    if (
      isChanged(data.payload.before, data.payload.after, 'id') ||
      isChanged(data.payload.before, data.payload.after, 'deleted') ||
      isChanged(data.payload.before, data.payload.after, 'banned') ||
      isChanged(data.payload.before, data.payload.after, 'tagsStr') ||
      isChanged(data.payload.before, data.payload.after, 'createdAt') ||
      isChanged(data.payload.before, data.payload.after, 'authorId') ||
      isChanged(data.payload.before, data.payload.after, 'sourceId') ||
      isChanged(data.payload.before, data.payload.after, 'creatorTwitter')
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
  con: Connection,
  logger: FastifyLoggerInstance,
  data: ChangeMessage<PostReport>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    const post = await con
      .getRepository(Post)
      .findOne(data.payload.after.postId);
    if (post) {
      await notifyPostReport(
        data.payload.after.userId,
        post,
        reportReasons.get(data.payload.after.reason),
        data.payload.after.comment,
      );
    }
  }
};

const onSourceFeedChange = async (
  con: Connection,
  logger: FastifyLoggerInstance,
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

const getTableName = <Entity>(
  con: Connection,
  target: EntityTarget<Entity>,
): string => con.getRepository(target).metadata.tableName;

const worker: Worker = {
  subscription: 'api-cdc',
  maxMessages: 10,
  handler: async (message, con, logger): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: ChangeMessage<any> = messageToJson(message);
      if (data.schema.name === 'io.debezium.connector.common.Heartbeat') {
        return;
      }
      switch (data.payload.source.table) {
        case getTableName(con, SourceRequest):
          await onSourceRequestChange(con, logger, data);
          break;
        case getTableName(con, Upvote):
          await onPostUpvoteChange(con, logger, data);
          break;
        case getTableName(con, CommentUpvote):
          await onCommentUpvoteChange(con, logger, data);
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
        case getTableName(con, Alerts):
          await onAlertsChange(con, logger, data);
          break;
        case getTableName(con, SourceFeed):
          await onSourceFeedChange(con, logger, data);
          break;
        case getTableName(con, Settings):
          await onSettingsChange(con, logger, data);
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
