import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';

interface Data {
  userId: string;
  commentId: string;
}

const worker: Worker = {
  subscription: 'comment-upvote-canceled-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const logDetails = { data, messageId: message.messageId };

    try {
      const comment = await con
        .getRepository(Comment)
        .findOneBy({ id: data.commentId });

      if (!comment) {
        logger.info(logDetails, 'comment does not exist');
        return;
      }

      if (comment.userId !== data.userId) {
        await con
          .getRepository(ReputationEvent)
          .createQueryBuilder()
          .delete()
          .where({
            grantById: data.userId,
            grantToId: comment.userId,
            targetId: comment.id,
            targetType: ReputationType.Comment,
            reason: ReputationReason.CommentUpvoted,
          })
          .execute();
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
