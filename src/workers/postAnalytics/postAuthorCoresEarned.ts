import { queryReadReplica } from '../../common/queryReadReplica';
import { Post } from '../../entity/posts/Post';
import { PostAnalytics } from '../../entity/posts/PostAnalytics';
import { UserTransactionType } from '../../entity/user/UserTransaction';
import type { TypedWorker } from '../worker';

const skipTransactionTypes = [
  UserTransactionType.PostBoost,
  UserTransactionType.SquadBoost,
];

export const postAuthorCoresEarned: TypedWorker<'api.v1.user-transaction'> = {
  subscription: 'api.post-author-cores-earned',
  handler: async ({ data }, con): Promise<void> => {
    const { transaction } = data;

    if (!transaction) {
      return;
    }

    if (
      skipTransactionTypes.includes(
        transaction.referenceType as UserTransactionType,
      )
    ) {
      return;
    }

    const post = await queryReadReplica<Pick<Post, 'id' | 'authorId'> | null>(
      con,
      async ({ queryRunner }) => {
        if (!transaction.referenceId) {
          return null;
        }

        return queryRunner.manager.getRepository(Post).findOne({
          select: ['id', 'authorId'],
          where: { id: transaction.referenceId },
        });
      },
    );

    if (!post?.authorId) {
      return;
    }

    if (transaction.receiverId !== post.authorId) {
      return;
    }

    await con
      .getRepository(PostAnalytics)
      .createQueryBuilder()
      .insert()
      .into(PostAnalytics, ['id', 'coresEarned'])
      .values({
        id: post.id,
        coresEarned: transaction.valueIncFees,
      })
      .onConflict(
        `("id") DO UPDATE SET "coresEarned" = post_analytics."coresEarned" + EXCLUDED."coresEarned"`,
      )
      .returning([])
      .execute();
  },
};
