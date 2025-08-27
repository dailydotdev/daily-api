import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from './../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { PostReport } from '../entity/PostReport';
import { Post, PostType } from '../entity';
import { ChangeObject } from '../types';
import { DELETED_BY_WORKER } from '../common';

interface Data {
  post: ChangeObject<Post>;
  method: 'hard' | 'soft';
}

const worker: Worker = {
  subscription: 'post-banned-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { method } = data;
    const { id, authorId, scoutId, flags, type } = data.post;
    const parsedFlags =
      typeof flags === 'string' ? JSON.parse(flags as string) : flags;
    const { deletedBy } = parsedFlags;

    /**
     * We don't deduct reputation on hard deletion or welcome post
     */
    if (
      method === 'hard' ||
      type === PostType.Welcome ||
      deletedBy === DELETED_BY_WORKER
    ) {
      return;
    }

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
