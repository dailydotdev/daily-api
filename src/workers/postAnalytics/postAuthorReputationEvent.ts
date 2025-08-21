import { queryReadReplica } from '../../common/queryReadReplica';
import { Post } from '../../entity/posts/Post';
import { PostAnalytics } from '../../entity/posts/PostAnalytics';
import { ReputationType } from '../../entity/ReputationEvent';
import type { TypedWorker } from '../worker';

export const postAuthorReputationEvent: TypedWorker<'api.v1.reputation-event'> =
  {
    subscription: 'api.post-author-reputation-event',
    handler: async ({ data }, con): Promise<void> => {
      const { op, payload } = data;

      if (payload.targetType !== ReputationType.Post) {
        return;
      }

      if (!['c', 'd'].includes(op)) {
        return;
      }

      const post = await queryReadReplica<Pick<Post, 'id' | 'authorId'> | null>(
        con,
        ({ queryRunner }) => {
          return queryRunner.manager.getRepository(Post).findOne({
            select: ['id', 'authorId'],
            where: { id: payload.targetId },
          });
        },
      );

      if (!post?.authorId) {
        return;
      }

      if (post.authorId !== payload.grantToId) {
        return;
      }

      await con
        .getRepository(PostAnalytics)
        .createQueryBuilder()
        .insert()
        .into(PostAnalytics, ['id', 'reputation'])
        .values({
          id: payload.targetId,
          reputation: op === 'c' ? payload.amount : -payload.amount,
        })
        .onConflict(
          `("id") DO UPDATE SET reputation = post_analytics.reputation + EXCLUDED.reputation`,
        )
        .returning([])
        .execute();
    },
  };
