import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { PostReport } from '../entity/PostReport';
import { COMMUNITY_PICKS_SOURCE, Post } from '../entity';
import { ChangeObject } from '../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'post-banned-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { id, authorId, scoutId } = data.post;
    try {
      await con.transaction(async (transaction) => {
        const reports = await transaction
          .getRepository(PostReport)
          .find({ postId: id });
        const repo = transaction.getRepository(ReputationEvent);
        const events = reports.map(({ userId }) =>
          repo.create({
            grantToId: userId,
            targetId: id,
            targetType: ReputationType.Post,
            reason: ReputationReason.PostReportConfirmed,
          }),
        );

        const ownerProps = {
          targetId: id,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostBanned,
        };

        // Skipping penalizing community picks during the beta phase
        if (data.post.sourceId !== COMMUNITY_PICKS_SOURCE) {
          if (authorId) {
            const authorEvent = repo.create({
              ...ownerProps,
              grantToId: authorId,
            });
            events.push(authorEvent);
          }

          if (scoutId) {
            const scoutEvent = repo.create({
              ...ownerProps,
              grantToId: scoutId,
            });
            events.push(scoutEvent);
          }
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
