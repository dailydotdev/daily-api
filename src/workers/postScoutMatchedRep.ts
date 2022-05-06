import { Submission, SubmissionStatus } from './../entity/Submission';
import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from '../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { Post } from '../entity';

interface Data {
  scoutId: string;
  postId: string;
}

const worker: Worker = {
  subscription: 'post-scout-matched-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const logDetails = { data, messageId: message.messageId };
    try {
      await con.transaction(async (transaction) => {
        const post = await transaction.getRepository(Post).findOne(data.postId);

        if (!post?.scoutId || post?.authorId === data.scoutId) {
          return;
        }

        await transaction
          .getRepository(Submission)
          .update(
            { userId: data.scoutId, url: post.url },
            { status: SubmissionStatus.Accepted },
          );
        const repo = transaction.getRepository(ReputationEvent);
        const event = repo.create({
          grantToId: post.scoutId,
          targetId: post.id,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostSubmissionApproved,
        });

        await repo
          .createQueryBuilder()
          .insert()
          .values(event)
          .orIgnore()
          .execute();
        logger.info(
          logDetails,
          'increased reputation due to post submission approved',
        );
      });
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to increase reputation for approved post submission',
      );
    }
  },
};

export default worker;
