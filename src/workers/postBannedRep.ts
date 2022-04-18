import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { PostReport } from '../entity/PostReport';
import { Post } from '../entity';
import { ChangeObject } from '../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'post-banned-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { id, authorId } = data.post;
    try {
      await con.transaction(async (transaction) => {
        const reports = await transaction
          .getRepository(PostReport)
          .find({ postId: id });
        const userIds = reports.map(({ userId }) => userId);
        const repo = transaction.getRepository(ReputationEvent);
        const events = userIds.map((userId) =>
          repo.create({
            grantToId: userId,
            targetId: id,
            targetType: ReputationType.Post,
            reason: ReputationReason.PostReportConfirmed,
          }),
        );
        if (authorId) {
          const authorEvent = repo.create({
            grantToId: authorId,
            targetId: id,
            targetType: ReputationType.Post,
            reason: ReputationReason.PostBanned,
          });
          events.push(authorEvent);
        }
        await repo
          .createQueryBuilder()
          .insert()
          .values(events)
          .orIgnore()
          .execute();
        logger.info(
          {
            data,
            messageId: message.messageId,
          },
          'increased reputation due to post banned or removed',
        );
      });
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to increase reputation due to post banned or removed',
      );
    }
  },
};

export default worker;
