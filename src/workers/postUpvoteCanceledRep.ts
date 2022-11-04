import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { Post } from '../entity';

interface Data {
  userId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-upvote-canceled-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const post = await con.getRepository(Post).findOneBy({ id: data.postId });
      if (post?.authorId && post?.authorId !== data.userId) {
        await con
          .getRepository(ReputationEvent)
          .createQueryBuilder()
          .delete()
          .where({
            grantById: data.userId,
            grantToId: post.authorId,
            targetId: post.id,
            targetType: ReputationType.Post,
            reason: ReputationReason.PostUpvoted,
          })
          .execute();
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'decreased reputation due to post upvote cancellation',
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to increase reputation due to post upvote cancellation',
      );
    }
  },
};

export default worker;
