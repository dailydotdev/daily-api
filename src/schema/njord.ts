import type { AuthContext, BaseContext } from '../Context';
import type { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import {
  awardPost,
  AwardType,
  awardUser,
  type AwardInput,
  type TransactionCreated,
} from '../common/njord';
import { ForbiddenError } from 'apollo-server-errors';
import { toGQLEnum } from '../common';

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(AwardType, 'AwardType')}

  type TransactionCreated {
    """
    Id of the transaction
    """
    transactionId: ID!
  }

  extend type Mutation {
    """
    Award entity (post, comment, user etc.)
    """
    award(
      """
      Id of the product to award
      """
      productId: ID!

      """
      Entity type to award
      """
      type: AwardType!

      """
      Id of the post to award
      """
      entityId: ID!

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
    award: async (
      _: unknown,
      props: AwardInput,
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      switch (props.type) {
        case AwardType.Post:
          return awardPost(props, ctx);
        case AwardType.User:
          return awardUser(props, ctx);
        default:
          throw new ForbiddenError('Can not award this entity');
      }
    },
  },
});
