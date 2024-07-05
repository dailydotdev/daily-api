import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
  REPUTATION_THRESHOLD,
  Post,
  User,
} from '../entity';
import { TypedWorker } from './worker';

const worker: TypedWorker<'api.v1.post-downvoted'> = {
  subscription: 'api.post-downvoted-rep',
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
          logger.info(logDetails, 'grantBy user does not exist');

          return;
        }

        if (grantBy.reputation < REPUTATION_THRESHOLD) {
          logger.info(
            logDetails,
            `downvoter's reputation doesn't meet the threshold to grant reputation`,
          );
          return;
        }

        const repo = transaction.getRepository(ReputationEvent);
        const props = {
          grantById: data.userId,
          targetId: post.id,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostDownvoted,
        };

        const events = [];
        let hasScout = false;

        if (post.scoutId && post.scoutId !== data.userId) {
          hasScout = true;
          events.push(
            repo.create({
              grantToId: post.scoutId,
              ...props,
            }),
          );
        }

        /**
         * Business logic states that we only decrease reputation of the author if there is no scout associated with the post
         */
        if (post.authorId && post.authorId !== data.userId && !hasScout) {
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
        logger.info(logDetails, 'decreased reputation due to post downvote');
      });
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to decrease reputation due to post downvote',
      );
    }
  },
};

export default worker;
