import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import { increaseReputation } from '../common';

interface Data {
  userId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-upvote-canceled-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const post = await con.getRepository(Post).findOne(data.postId);
      if (post?.authorId && post?.authorId !== data.userId) {
        const repo = con.getRepository(ReputationEvent);
        const event = await repo.findOne({
          grantById: data.userId,
          grantToId: post.authorId,
          targetId: post.id,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostUpvoted,
        });
        await increaseReputation(con, logger, post.authorId, -event.amount);
        await repo.delete(event);
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
