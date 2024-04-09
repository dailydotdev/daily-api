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
    const { id, authorId, scoutId, flags } = data.post;
    const { deletedBy } = flags;
    try {
      await con.transaction(async (transaction) => {
        const reports = await transaction
          .getRepository(PostReport)
          .findBy({ postId: id });
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

        /**
         * Ensure authors can remove their own post
         * Ensure scouts can't add posts/remove them to decrease author reputation
         */
        if (authorId && authorId !== deletedBy && scoutId !== deletedBy) {
          const authorEvent = repo.create({
            ...ownerProps,
            grantToId: authorId,
          });
          events.push(authorEvent);
        }

        if (scoutId && scoutId !== deletedBy) {
          const scoutEvent = repo.create({
            ...ownerProps,
            grantToId: scoutId,
          });
          events.push(scoutEvent);
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
