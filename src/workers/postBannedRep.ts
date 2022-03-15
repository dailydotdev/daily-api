import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { increaseMultipleReputation, increaseReputation } from '../common';
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
      const reports = await con.getRepository(PostReport).find({ postId: id });
      const userIds = reports.map(({ userId }) => userId);
      const repo = con.getRepository(ReputationEvent);
      const events = userIds.map((userId) =>
        repo.create({
          grantToId: userId,
          targetId: id,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostReportConfirmed,
        }),
      );
      await repo.save(events);
      await increaseMultipleReputation(con, logger, userIds, events[0].amount);
      if (authorId) {
        const authorEvent = await repo.save(
          repo.create({
            grantToId: authorId,
            targetId: id,
            targetType: ReputationType.Post,
            reason: ReputationReason.PostBanned,
          }),
        );
        await increaseReputation(con, logger, authorId, authorEvent.amount);
      }
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'increased reputation due to post banned or removed',
      );
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
