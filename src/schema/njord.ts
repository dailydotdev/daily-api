import type { AuthContext, BaseContext } from '../Context';
import type { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import {
  createTransaction,
  transferCores,
  type TransactionProps,
} from '../common/njord';
import { queryReadReplica } from '../common/queryReadReplica';
import { Product, ProductType } from '../entity/Product';
import { ForbiddenError } from 'apollo-server-errors';
import { Post } from '../entity/posts/Post';
import { UserPost } from '../entity';
import { ConflictError } from '../errors';
import { isSpecialUser } from '../common';

type UserAwardInput = Pick<
  TransactionProps,
  'productId' | 'receiverId' | 'note'
>;

type PostAwardInput = Pick<TransactionProps, 'productId' | 'note'> & {
  postId: string;
};

type TransactionCreated = {
  transactionId: string;
};

const canAward = async ({
  ctx,
  receiverId,
}: {
  ctx: AuthContext;
  receiverId?: string | null;
}): Promise<void> => {
  if (ctx.userId === receiverId) {
    throw new ForbiddenError('Can not award yourself');
  }

  if (isSpecialUser({ userId: receiverId })) {
    throw new ForbiddenError('Can not award this user');
  }
};

export const typeDefs = /* GraphQL */ `
  type TransactionCreated {
    """
    Id of the transaction
    """
    transactionId: ID!
  }

  extend type Mutation {
    """
    Award user
    """
    awardUser(
      """
      Id of the product to award
      """
      productId: ID!

      """
      Id of the user which will get the award
      """
      receiverId: ID!

      """
      Note for the receiver
      """
      note: String
    ): TransactionCreated @auth

    """
    Award post author
    """
    awardPost(
      """
      Id of the product to award
      """
      productId: ID!

      """
      Id of the post to award
      """
      postId: ID!

      """
      Note for the receiver
      """
      note: String
    ): TransactionCreated @auth
  }
`;

export interface GQLCustomData {
  appsId: string;
  label: string;
}

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Mutation: {
    awardUser: async (
      _,
      props: UserAwardInput,
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      await canAward({ ctx, ...props });

      const product = await queryReadReplica<Pick<Product, 'id' | 'type'>>(
        ctx.con,
        async ({ queryRunner }) => {
          return queryRunner.manager.getRepository(Product).findOneOrFail({
            select: ['id', 'type'],
            where: {
              id: props.productId,
            },
          });
        },
      );

      if (product.type !== ProductType.Award) {
        throw new ForbiddenError('Can not award this product');
      }

      const transaction = await ctx.con.transaction(async (entityManager) => {
        const { receiverId, note } = props;

        const transaction = await createTransaction({
          ctx,
          entityManager,
          productId: product.id,
          receiverId,
          note,
        });

        await transferCores({
          ctx,
          transaction,
        });

        return transaction;
      });

      return {
        transactionId: transaction.id,
      };
    },
    awardPost: async (
      _,
      props: PostAwardInput,
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      const [product, post, userPost] = await queryReadReplica<
        [
          Pick<Product, 'id' | 'type'>,
          Pick<Post, 'id' | 'authorId'>,
          Pick<UserPost, 'awardTransactionId'> | null,
        ]
      >(ctx.con, async ({ queryRunner }) => {
        return Promise.all([
          queryRunner.manager.getRepository(Product).findOneOrFail({
            select: ['id', 'type'],
            where: {
              id: props.productId,
            },
          }),
          queryRunner.manager.getRepository(Post).findOneOrFail({
            select: ['id', 'authorId'],
            where: {
              id: props.postId,
            },
          }),
          queryRunner.manager.getRepository(UserPost).findOne({
            select: ['awardTransactionId'],
            where: {
              postId: props.postId,
              userId: ctx.userId,
            },
          }),
        ]);
      });

      await canAward({ ctx, receiverId: post.authorId });

      if (product.type !== ProductType.Award) {
        throw new ForbiddenError('Can not award this product');
      }

      if (userPost?.awardTransactionId) {
        throw new ConflictError('Post already awarded');
      }

      const transaction = await ctx.con.transaction(async (entityManager) => {
        if (!post.authorId) {
          throw new ConflictError('Post does not have an author');
        }

        const { note } = props;

        const transaction = await createTransaction({
          ctx,
          entityManager,
          productId: product.id,
          receiverId: post.authorId,
          note,
        });

        if (!transaction.productId) {
          throw new Error('Product missing from transaction');
        }

        await entityManager
          .getRepository(UserPost)
          .createQueryBuilder()
          .insert()
          .into(UserPost)
          .values({
            postId: post.id,
            userId: ctx.userId,
            awardTransactionId: transaction.id,
            flags: {
              awardId: transaction.productId,
            },
          })
          .onConflict(
            `("postId", "userId") DO UPDATE SET "awardTransactionId" = EXCLUDED."awardTransactionId", "flags" = user_post.flags || EXCLUDED."flags"`,
          )
          .execute();

        await transferCores({
          ctx,
          transaction,
        });

        return transaction;
      });

      return {
        transactionId: transaction.id,
      };
    },
  },
});
