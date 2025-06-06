import type { AuthContext, BaseContext, Context } from '../Context';
import type { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import {
  awardComment,
  type AwardInput,
  awardPost,
  awardSquad,
  AwardType,
  awardUser,
  type GetBalanceResult,
  type TransactionCreated,
} from '../common/njord';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { getLimit, toGQLEnum } from '../common';
import { z } from 'zod';
import { type Product, ProductType } from '../entity/Product';
import type { Connection, ConnectionArguments } from 'graphql-relay';
import { offsetPageGenerator } from './common';
import graphorm from '../graphorm';
import {
  UserTransaction,
  UserTransactionFlagsPublic,
  UserTransactionStatus,
} from '../entity/user/UserTransaction';
import { queryReadReplica } from '../common/queryReadReplica';
import { Brackets } from 'typeorm';
import { checkCoresAccess } from '../common/user';
import { CoresRole } from '../types';

export type GQLProduct = Pick<
  Product,
  'id' | 'type' | 'name' | 'image' | 'value' | 'flags'
>;

export type GQLUserTransaction = Pick<
  UserTransaction,
  | 'id'
  | 'productId'
  | 'product'
  | 'status'
  | 'receiverId'
  | 'receiver'
  | 'senderId'
  | 'sender'
  | 'value'
  | 'createdAt'
  | 'valueIncFees'
> & {
  flags: UserTransactionFlagsPublic;
  balance: GetBalanceResult;
};

type GQLUserTransactionSummary = {
  purchased: number;
  received: number;
  spent: number;
};

type GQLUserProductSummary = Pick<Product, 'id' | 'name' | 'image'> & {
  count: number;
};

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(AwardType, 'AwardType')}

  ${toGQLEnum(ProductType, 'ProductType')}

  type UserBalance {
    amount: Int!
  }

  type TransactionCreated {
    """
    Id of the transaction
    """
    transactionId: ID!

    """
    Balance of the user
    """
    balance: UserBalance!
  }

  type ProductFlagsPublic {
    description: String
    imageGlow: String
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

  type UserTransactionFlagsPublic {
    note: String
    error: String
    sourceId: String
  }

  type UserTransaction {
    id: ID!
    productId: ID
    product: Product
    status: Int!
    receiverId: ID!
    receiver: User!
    senderId: ID
    sender: User
    value: Int!
    flags: UserTransactionFlagsPublic
    balance: UserBalance!
    createdAt: DateTime!
    valueIncFees: Int!
  }

  type UserTransactionSummary {
    purchased: Int!
    received: Int!
    spent: Int!
  }

  type UserTransactionEdge {
    node: UserTransaction!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type UserTransactionConnection {
    pageInfo: PageInfo!

    edges: [UserTransactionEdge!]!
  }

  type UserProductSummary {
    id: ID!
    name: String!
    image: String!
    count: Int!
  }

  type UserTransactionPublic {
    value: Int!
  }

  extend type Query {
    """
    List products
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

    """
    Get transaction by provider id
    """
    transactionByProvider(
      """
      Id of the transaction
      """
      id: ID
    ): UserTransaction @auth

    """
    Get current user transactions summary
    """
    transactionSummary: UserTransactionSummary @auth

    """
    Get user transactions
    """
    transactions(
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
    ): UserTransactionConnection @auth

    """
    Get product summary for user
    """
    userProductSummary(
      """
      User id (receiver of awards)
      """
      userId: ID!

      """
      Limit
      """
      limit: Int = 24

      """
      Product type
      """
      type: ProductType!
    ): [UserProductSummary!]
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

      """
      Extra flags for the transaction
      """
      flags: UserTransactionFlagsPublic
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
          builder.queryBuilder
            .limit(page.limit)
            .offset(page.offset)
            .addOrderBy(`${builder.alias}."value"`, 'ASC');

          return builder;
        },
        undefined,
        true,
      );
    },
    transactionByProvider: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info,
    ) => {
      return graphorm.queryOneOrFail<GQLUserTransaction>(
        ctx,
        info,
        (builder) => {
          return {
            ...builder,
            queryBuilder: builder.queryBuilder
              .andWhere(`${builder.alias}.flags->>'providerId' = :providerId`, {
                providerId: id,
              })
              .andWhere(`${builder.alias}."receiverId" = :receiverId`, {
                receiverId: ctx.userId,
              }),
          };
        },
      );
    },
    transactionSummary: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLUserTransactionSummary> => {
      const [purchased, received, spent] = await queryReadReplica(
        ctx.con,
        async ({ queryRunner }) => {
          const summary: { amount: string }[] = await Promise.all([
            queryRunner.manager
              .createQueryBuilder(UserTransaction, 'ut')
              .select('COALESCE(SUM(ut.value), 0)', 'amount')
              .where('ut."receiverId" = :userId', { userId: ctx.userId })
              .andWhere('ut."senderId" IS NULL')
              .andWhere('ut."productId" IS NULL')
              .andWhere('ut.status = :status', {
                status: UserTransactionStatus.Success,
              })
              .getRawOne(),
            queryRunner.manager
              .createQueryBuilder(UserTransaction, 'ut')
              .select('COALESCE(SUM(ut.valueIncFees), 0)', 'amount')
              .where('ut."receiverId" = :userId', { userId: ctx.userId })
              .andWhere('ut."senderId" IS NOT NULL')
              .andWhere('ut.status = :status', {
                status: UserTransactionStatus.Success,
              })
              .getRawOne(),
            queryRunner.manager
              .createQueryBuilder(UserTransaction, 'ut')
              .select('COALESCE(SUM(ut.value), 0)', 'amount')
              .where('ut."receiverId" IS NOT NULL')
              .andWhere('ut."senderId" = :userId', { userId: ctx.userId })
              .andWhere('ut."productId" IS NOT NULL')
              .andWhere('ut.status = :status', {
                status: UserTransactionStatus.Success,
              })
              .getRawOne(),
          ]);

          return summary.map((item) => +item.amount);
        },
      );

      return {
        purchased,
        received,
        spent,
      };
    },
    transactions: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLUserTransaction>> => {
      const pageGenerator = offsetPageGenerator<GQLUserTransaction>(10, 100);
      const page = pageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) => pageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .andWhere(
              new Brackets((qb) => {
                return qb
                  .where(`${builder.alias}."receiverId" = :receiverId`, {
                    receiverId: ctx.userId,
                  })
                  .orWhere(`${builder.alias}."senderId" = :senderId`, {
                    senderId: ctx.userId,
                  });
              }),
            )
            .andWhere(`${builder.alias}.status NOT IN (:...status)`, {
              status: [UserTransactionStatus.Created],
            });

          builder.queryBuilder
            .limit(page.limit)
            .offset(page.offset)
            .addOrderBy(`${builder.alias}."createdAt"`, 'DESC');

          return builder;
        },
        undefined,
        true,
      );
    },
    userProductSummary: async (
      _,
      {
        userId,
        limit,
        type,
      }: { userId: string; limit: number; type: ProductType },
      ctx: Context,
    ): Promise<GQLUserProductSummary[]> => {
      const result = await queryReadReplica(ctx.con, ({ queryRunner }) => {
        return queryRunner.manager
          .getRepository(UserTransaction)
          .createQueryBuilder('ut')
          .innerJoin('Product', 'p', 'p.id = ut.productId')
          .select('p.id', 'id')
          .addSelect('p.name', 'name')
          .addSelect('p.image', 'image')
          .addSelect('COUNT(p.id)', 'count')
          .where('ut.receiverId = :receiverId', {
            receiverId: userId,
          })
          .andWhere('p.type = :type', { type })
          .andWhere('ut.status = :status', {
            status: UserTransactionStatus.Success,
          })
          .groupBy('ut."productId"')
          .addGroupBy('p.id')
          .limit(getLimit({ limit, max: 100 }))
          .orderBy('count', 'DESC')
          .getRawMany();
      });

      return result;
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

      if (
        (await checkCoresAccess({
          ctx,
          userId: ctx.userId,
          requiredRole: CoresRole.User,
        })) === false
      ) {
        throw new ForbiddenError('You can not award yet');
      }

      switch (props.type) {
        case AwardType.Post:
          return awardPost(props, ctx);
        case AwardType.User:
          return awardUser(props, ctx);
        case AwardType.Comment:
          return awardComment(props, ctx);
        case AwardType.Squad:
          return awardSquad(props, ctx);
        default:
          throw new ForbiddenError('Can not award this entity');
      }
    },
  },
});
