import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
  REPUTATION_THRESHOLD,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { Comment, User } from '../entity';

interface Data {
  userId: string;
  commentId: string;
}

const worker: Worker = {
  subscription: 'comment-upvoted-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const logDetails = { data, messageId: message.messageId };
    try {
      await con.transaction(async (transaction) => {
        const comment = await transaction
          .getRepository(Comment)
          .findOne(data.commentId);

        if (!comment) {
          logger.info(logDetails, 'comment does not exist');
          return;
        }

        const grantBy = await transaction
          .getRepository(User)
          .findOne(data.userId);

        if (comment.userId === grantBy.id) {
          logger.info(
            logDetails,
            `upvoting own comment won't grant reputation`,
          );
          return;
        }

        if (grantBy.reputation < REPUTATION_THRESHOLD) {
          logger.info(
            logDetails,
            `upvoter's reputation doesn't meet the threshold to grant reputation`,
          );
          return;
        }

        const repo = transaction.getRepository(ReputationEvent);
        const event = repo.create({
          grantById: data.userId,
          grantToId: comment.userId,
          targetId: comment.id,
          targetType: ReputationType.Comment,
          reason: ReputationReason.CommentUpvoted,
        });
        await repo
          .createQueryBuilder()
          .insert()
          .values(event)
          .orIgnore()
          .execute();
        logger.info(logDetails, 'increased reputation due to upvote');
      });
    } catch (err) {
      logger.error(
        { ...logDetails, err },
        'failed to increase reputation due to upvote',
      );
    }
  },
};

export default worker;
