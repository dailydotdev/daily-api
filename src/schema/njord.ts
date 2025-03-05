import type { AuthContext, BaseContext } from '../Context';
import type { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { transferCores, type TransferProps } from '../common/njord';
import { queryReadReplica } from '../common/queryReadReplica';
import { Product, ProductType } from '../entity/Product';
import { ForbiddenError } from 'apollo-server-errors';
import { Post } from '../entity/posts/Post';
import { UserPost } from '../entity';
import { ConflictError } from '../errors';

type UserAwardInput = Pick<TransferProps, 'productId' | 'receiverId' | 'note'>;

type PostAwardInput = Pick<TransferProps, 'productId' | 'note'> & {
  postId: string;
};

export const typeDefs = /* GraphQL */ `
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
    ): EmptyResponse @auth

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
    ): EmptyResponse
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
      { productId, receiverId, note }: UserAwardInput,
      ctx: AuthContext,
    ) => {
      const product = await queryReadReplica<Pick<Product, 'type'>>(
        ctx.con,
        async ({ queryRunner }) => {
          return queryRunner.manager.getRepository(Product).findOneOrFail({
            select: ['type'],
            where: {
              id: productId,
            },
          });
        },
      );

      if (product.type !== ProductType.Award) {
        throw new ForbiddenError('Can not gift this product');
      }

      await transferCores({
        ctx,
        receiverId,
        productId,
        note,
      });

      return { _: true };
    },
    awardPost: async (
      _,
      { productId, postId, note }: PostAwardInput,
      ctx: AuthContext,
    ) => {
      // TODO add @auth directive
      ctx.req.userId = '5GHEUpildSXvvbOdcfing';

      const [product, post, userPost] = await queryReadReplica<
        [
          Pick<Product, 'type'>,
          Pick<Post, 'id' | 'authorId'>,
          Pick<UserPost, 'awardTransactionId'> | null,
        ]
      >(ctx.con, async ({ queryRunner }) => {
        return Promise.all([
          queryRunner.manager.getRepository(Product).findOneOrFail({
            select: ['type'],
            where: {
              id: productId,
            },
          }),
          queryRunner.manager.getRepository(Post).findOneOrFail({
            select: ['id', 'authorId'],
            where: {
              id: postId,
            },
          }),
          queryRunner.manager.getRepository(UserPost).findOne({
            select: ['awardTransactionId'],
            where: {
              postId,
              userId: ctx.userId,
            },
          }),
        ]);
      });

      if (product.type !== ProductType.Award) {
        throw new ForbiddenError('Can not gift this product');
      }

      if (!post.authorId) {
        throw new ConflictError('Post does not have an author');
      }

      if (userPost?.awardTransactionId) {
        throw new ConflictError('Post already awarded');
      }

      const transaction = await transferCores({
        ctx,
        receiverId: post.authorId,
        productId,
        note,
      });

      if (!transaction.productId) {
        throw new Error('Product missing from transaction');
      }

      await ctx.con
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

      return { _: true };
    },
  },
});
