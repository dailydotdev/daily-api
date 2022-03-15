import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { increaseReputation } from '../common';

interface Data {
  userId: string;
  commentId: string;
}

const worker: Worker = {
  subscription: 'comment-upvoted-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con.getRepository(Comment).findOne(data.commentId);
      if (!comment) {
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'comment does not exist',
        );
        return;
      }
      if (comment.userId !== data.userId) {
        const repo = con.getRepository(ReputationEvent);
        const event = await repo.save(
          repo.create({
            grantById: data.userId,
            grantToId: comment.userId,
            targetId: comment.id,
            targetType: ReputationType.Comment,
            reason: ReputationReason.CommentUpvote,
          }),
        );
        await increaseReputation(con, logger, comment.userId, event.amount);
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'increased reputation due to upvote',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to increase reputation due to upvote',
      );
    }
  },
};

export default worker;
