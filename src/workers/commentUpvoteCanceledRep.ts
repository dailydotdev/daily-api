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
  subscription: 'comment-upvote-canceled-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con.getRepository(Comment).findOne(data.commentId);
      if (comment.userId !== data.userId) {
        const repo = con.getRepository(ReputationEvent);
        const event = await repo.findOne({
          grantById: data.userId,
          grantToId: comment.userId,
          targetId: comment.id,
          targetType: ReputationType.Comment,
          reason: ReputationReason.CommentUpvote,
        });
        await increaseReputation(con, logger, comment.userId, -event.amount);
        await repo.delete(event);
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'decreased reputation due to upvote cancellation',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to increase reputation due to upvote cancellation',
      );
    }
  },
};

export default worker;
