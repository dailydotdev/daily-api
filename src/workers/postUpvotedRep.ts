import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
  REPUTATION_THRESHOLD,
} from './../entity/ReputationEvent';
import { TypedWorker } from './worker';
import { Post, User } from '../entity';

const worker: TypedWorker<'post-upvoted'> = {
  subscription: 'post-upvoted-rep',
  handler: async (message, con, logger): Promise<void> => {
    const { data } = message;
    const logDetails = { data, messageId: message.messageId };
    try {
      await con.transaction(async (transaction) => {
        const post = await transaction
          .getRepository(Post)
          .findOneBy({ id: data.postId });
        if (!post?.authorId && !post?.scoutId) {
          return;
        }

        const grantBy = await transaction
          .getRepository(User)
          .findOneBy({ id: data.userId });

        if (!grantBy) {
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
        const props = {
          grantById: data.userId,
          targetId: post.id,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostUpvoted,
        };

        const events = [];

        if (post.scoutId && post.scoutId !== data.userId) {
          events.push(
            repo.create({
              grantToId: post.scoutId,
              ...props,
            }),
          );
        }

        if (post.authorId && post.authorId !== data.userId) {
          events.push(
            repo.create({
              grantToId: post.authorId,
              ...props,
            }),
          );
        }

        await repo
          .createQueryBuilder()
          .insert()
          .values(events)
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
