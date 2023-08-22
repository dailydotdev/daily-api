import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import { In } from 'typeorm';

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
      const userIds = [];

      if (post?.authorId && post.authorId !== data.userId) {
        userIds.push(post.authorId);
      }

      if (post?.scoutId && post.scoutId !== data.userId) {
        userIds.push(post.scoutId);
      }

      if (userIds.length) {
        await con.getRepository(ReputationEvent).delete({
          grantById: data.userId,
          grantToId: In(userIds),
          targetId: post.id,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostUpvoted,
        });

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
