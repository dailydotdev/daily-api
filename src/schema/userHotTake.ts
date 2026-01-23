import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { offsetPageGenerator, GQLEmptyResponse } from './common';
import { UserHotTake } from '../entity/user/UserHotTake';
import { ValidationError } from 'apollo-server-errors';
import {
  addUserHotTakeSchema,
  updateUserHotTakeSchema,
  reorderUserHotTakeSchema,
  type AddUserHotTakeInput,
  type UpdateUserHotTakeInput,
  type ReorderUserHotTakeInput,
} from '../common/schema/userHotTake';
import { NEW_ITEM_POSITION } from '../common/constants';

interface GQLUserHotTake {
  id: string;
  userId: string;
  emoji: string;
  title: string;
  subtitle: string | null;
  position: number;
  createdAt: Date;
}

const MAX_HOT_TAKES = 5;

export const typeDefs = /* GraphQL */ `
  type UserHotTake {
    id: ID!
    emoji: String!
    title: String!
    subtitle: String
    position: Int!
    createdAt: DateTime!
  }

  type UserHotTakeEdge {
    node: UserHotTake!
    cursor: String!
  }

  type UserHotTakeConnection {
    pageInfo: PageInfo!
    edges: [UserHotTakeEdge!]!
  }

  input AddUserHotTakeInput {
    emoji: String!
    title: String!
    subtitle: String
  }

  input UpdateUserHotTakeInput {
    emoji: String
    title: String
    subtitle: String
  }

  input ReorderUserHotTakeInput {
    id: ID!
    position: Int!
  }

  extend type Query {
    """
    Get a user's hot takes
    """
    userHotTakes(userId: ID!, first: Int, after: String): UserHotTakeConnection!
  }

  extend type Mutation {
    """
    Add a hot take to the user's profile (max 5)
    """
    addUserHotTake(input: AddUserHotTakeInput!): UserHotTake! @auth

    """
    Update a user's hot take
    """
    updateUserHotTake(id: ID!, input: UpdateUserHotTakeInput!): UserHotTake!
      @auth

    """
    Delete a user's hot take
    """
    deleteUserHotTake(id: ID!): EmptyResponse! @auth

    """
    Reorder user's hot takes
    """
    reorderUserHotTakes(items: [ReorderUserHotTakeInput!]!): [UserHotTake!]!
      @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    userHotTakes: async (
      _,
      args: { userId: string; first?: number; after?: string },
      ctx: Context,
      info,
    ) => {
      const pageGenerator = offsetPageGenerator<GQLUserHotTake>(50, 100);
      const page = pageGenerator.connArgsToPage({
        first: args.first,
        after: args.after,
      });

      return graphorm.queryPaginated<GQLUserHotTake>(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          pageGenerator.nodeToCursor(page, { first: args.first }, node, index),
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."userId" = :userId`, {
              userId: args.userId,
            })
            .orderBy(`"${builder.alias}"."position"`, 'ASC')
            .addOrderBy(`"${builder.alias}"."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);
          return builder;
        },
        undefined,
        true,
      );
    },
  },

  Mutation: {
    addUserHotTake: async (
      _,
      args: { input: AddUserHotTakeInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = addUserHotTakeSchema.parse(args.input);

      const count = await ctx.con.getRepository(UserHotTake).count({
        where: { userId: ctx.userId },
      });

      if (count >= MAX_HOT_TAKES) {
        throw new ValidationError(
          `Maximum of ${MAX_HOT_TAKES} hot takes allowed`,
        );
      }

      const hotTake = ctx.con.getRepository(UserHotTake).create({
        userId: ctx.userId,
        emoji: input.emoji,
        title: input.title,
        subtitle: input.subtitle || null,
        position: NEW_ITEM_POSITION,
      });

      await ctx.con.getRepository(UserHotTake).save(hotTake);

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: hotTake.id,
        });
        return builder;
      });
    },

    updateUserHotTake: async (
      _,
      args: { id: string; input: UpdateUserHotTakeInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = updateUserHotTakeSchema.parse(args.input);

      const hotTake = await ctx.con.getRepository(UserHotTake).findOne({
        where: { id: args.id, userId: ctx.userId },
      });

      if (!hotTake) {
        throw new ValidationError('Hot take not found');
      }

      const updateData: Partial<UserHotTake> = {};
      if (input.emoji !== undefined) {
        updateData.emoji = input.emoji;
      }
      if (input.title !== undefined) {
        updateData.title = input.title;
      }
      if (input.subtitle !== undefined) {
        updateData.subtitle = input.subtitle || null;
      }

      if (Object.keys(updateData).length > 0) {
        await ctx.con
          .getRepository(UserHotTake)
          .update({ id: args.id }, updateData);
      }

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: args.id,
        });
        return builder;
      });
    },

    deleteUserHotTake: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(UserHotTake)
        .delete({ id: args.id, userId: ctx.userId });

      return { _: true };
    },

    reorderUserHotTakes: async (
      _,
      args: { items: ReorderUserHotTakeInput[] },
      ctx: AuthContext,
      info,
    ) => {
      const items = reorderUserHotTakeSchema.parse(args.items);
      const ids = items.map((i) => i.id);

      const whenClauses = items
        .map((item) => `WHEN id = '${item.id}' THEN ${item.position}`)
        .join(' ');

      await ctx.con
        .getRepository(UserHotTake)
        .createQueryBuilder()
        .update()
        .set({ position: () => `CASE ${whenClauses} ELSE position END` })
        .where('id IN (:...ids)', { ids })
        .andWhere('"userId" = :userId', { userId: ctx.userId })
        .execute();

      return graphorm.query(ctx, info, (builder) => {
        builder.queryBuilder
          .where(`"${builder.alias}"."id" IN (:...ids)`, { ids })
          .andWhere(`"${builder.alias}"."userId" = :userId`, {
            userId: ctx.userId,
          })
          .orderBy(`"${builder.alias}"."position"`, 'ASC');
        return builder;
      });
    },
  },
});
