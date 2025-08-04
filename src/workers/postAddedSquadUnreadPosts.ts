import { Source, SourceMember, SourceType } from '../entity';
import { type TypedWorker } from './worker';
import { processStreamInBatches } from '../common/streaming';
import { In } from 'typeorm';
import { updateFlagsStatement } from '../common';

const CONCURRENCY = 1;
const BATCH_SIZE = 1000;

export const postAddedSquadUnreadPostsWorker: TypedWorker<'api.v1.post-visible'> =
  {
    subscription: 'api.post-added-squad-unread-posts',
    handler: async (message, con, logger): Promise<void> => {
      const { data } = message;

      try {
        const source = await con.getRepository(Source).findOneBy({
          id: data.post.sourceId,
        });

        if (!source) {
          logger.debug({ message }, 'Source not found');
          return;
        }

        if (source.type !== SourceType.Squad) {
          logger.debug({ message, source }, 'Source is not a squad');
          return;
        }

        const squadMembersStream = await con
          .createQueryBuilder()
          .select('sm."userId"')
          .from(SourceMember, 'sm')
          .where('sm.sourceId = :sourceId', { sourceId: source.id })
          .andWhere(`(sm.flags->>'hasUnreadPosts')::boolean != true`)
          .stream();

        await processStreamInBatches(
          squadMembersStream,
          async (batch: { userId: string }[]) => {
            await con.getRepository(SourceMember).update(
              {
                sourceId: source.id,
                userId: In(batch.map((b) => b.userId)),
              },
              {
                flags: updateFlagsStatement({
                  hasUnreadPosts: true,
                }),
              },
            );
          },
          CONCURRENCY,
          BATCH_SIZE,
        );
      } catch (_err) {
        const err = _err as Error;
        logger.error(
          { err, sourceId: data.post.sourceId, message },
          'Error updating source hasUnreadPosts flag',
        );
      }
    },
  };
