import type { AuthContext, BaseContext } from '../Context';
import type { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { transferCores, type TransferProps } from '../common/njord';
import { queryReadReplica } from '../common/queryReadReplica';
import { Product, ProductType } from '../entity/Product';
import { ForbiddenError } from 'apollo-server-errors';

type AwardInput = Pick<TransferProps, 'productId' | 'receiverId' | 'note'>;

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
      { productId, receiverId, note }: AwardInput,
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
    },
  },
});
