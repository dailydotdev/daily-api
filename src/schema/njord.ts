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
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { toGQLEnum } from '../common';
import { z } from 'zod';
import type { Product } from '../entity/Product';
import type { Connection, ConnectionArguments } from 'graphql-relay';
import { offsetPageGenerator } from './common';
import graphorm from '../graphorm';

export type GQLProduct = Pick<
  Product,
  'id' | 'type' | 'name' | 'image' | 'value' | 'flags'
>;

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(AwardType, 'AwardType')}

  type TransactionCreated {
    """
    Id of the transaction
    """
    transactionId: ID!
  }

  type ProductFlagsPublic {
    description: String
  }

  type Product {
    id: ID!
    type: String!
    name: String!
    image: String!
    value: Int!
    flags: ProductFlagsPublic
  }

  type ProductConnection {
    pageInfo: PageInfo!
    edges: [ProductEdge!]!
  }

  type ProductEdge {
    node: Product!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  extend type Query {
    """
    List feeds
    """
    products(
      """
      Paginate before opaque cursor
      """
      before: String
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
      """
      Paginate last
      """
      last: Int
    ): ProductConnection! @auth
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
  Query: {
    products: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLProduct>> => {
      const pageGenerator = offsetPageGenerator<GQLProduct>(10, 100);
      const page = pageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) => pageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder.limit(page.limit);

          builder.queryBuilder.orderBy(`${builder.alias}."value"`, 'ASC');

          return builder;
        },
        undefined,
        true,
      );
    },
  },
  Mutation: {
    award: async (
      _: unknown,
      props: AwardInput,
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      const validationSchema = z.object({
        productId: z.string().uuid('Invalid product id provided'),
        note: z.preprocess(
          (value) => (value as string)?.replace(/[‎\s]+/g, ' '),
          z
            .string()
            .trim()
            .max(400, 'That is a big note, try to keep it under 400 characters')
            .optional(),
        ),
      });
      const result = validationSchema.safeParse(props);

      if (result.error) {
        throw new ValidationError(result.error.errors[0].message);
      }

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
