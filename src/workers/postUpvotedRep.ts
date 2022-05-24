import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
  REPUTATION_THRESHOLD,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { Post, User } from '../entity';

interface Data {
  userId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-upvoted-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const logDetails = { data, messageId: message.messageId };
    try {
      await con.transaction(async (transaction) => {
        const post = await transaction.getRepository(Post).findOne(data.postId);
        if (
          (!post?.authorId && !post?.scoutId) ||
          post?.authorId === data.userId ||
          post?.scoutId === data.userId
        ) {
          return;
        }

        const grantBy = await transaction
          .getRepository(User)
          .findOne(data.userId);

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
          grantToId: post.scoutId || post.authorId,
          targetId: post.id,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostUpvoted,
        });

        await repo
          .createQueryBuilder()
          .insert()
          .values(event)
          .orIgnore()
          .execute();
        logger.info(logDetails, 'increased reputation due to post upvote');
      });
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to increase reputation due to post upvote',
      );
    }
  },
};

export default worker;
