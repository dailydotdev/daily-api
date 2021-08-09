import { messageToJson, Worker } from './worker';
import { Comment, CommentUpvote, SourceRequest, Upvote } from '../entity';
import {
  addOrRemoveSuperfeedrSubscription,
  notifyCommentCommented,
  notifyCommentUpvoteCanceled,
  notifyCommentUpvoted,
  notifyPostCommented,
  notifyPostUpvoteCanceled,
  notifyPostUpvoted,
  notifySourceRequest,
} from '../common';
import { ChangeMessage } from '../types';
import { Connection } from 'typeorm';
import { Logger } from 'fastify';
import { EntityTarget } from 'typeorm/common/EntityTarget';

const onSourceRequestChange = async (
  con: Connection,
  logger: Logger,
  data: ChangeMessage<SourceRequest>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    // New source request
    await notifySourceRequest(logger, 'new', data.payload.after);
  } else if (data.payload.op === 'u') {
    if (!data.payload.before.closed && data.payload.after.closed) {
      if (data.payload.after.approved) {
        // Source request published
        await addOrRemoveSuperfeedrSubscription(
          data.payload.after.sourceFeed,
          data.payload.after.sourceId,
          'subscribe',
        );
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
  logger: Logger,
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
  logger: Logger,
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
  logger: Logger,
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
  }
};

const getTableName = <Entity>(
  con: Connection,
  target: EntityTarget<Entity>,
): string => con.getRepository(target).metadata.tableName;

const worker: Worker = {
  subscription: 'cdc',
  handler: async (message, con, logger): Promise<void> => {
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
    }
  },
};

export default worker;
