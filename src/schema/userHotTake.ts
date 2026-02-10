import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { offsetPageGenerator, GQLEmptyResponse } from './common';
import { HotTake } from '../entity/user/HotTake';
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

export interface GQLHotTake {
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
  type HotTake {
    id: ID!
    emoji: String!
    title: String!
    subtitle: String
    position: Int!
    upvotes: Int!
    upvoted: Boolean
    createdAt: DateTime!
    user: User
  }

  type HotTakeEdge {
    node: HotTake!
    cursor: String!
  }

  type HotTakeConnection {
    pageInfo: PageInfo!
    edges: [HotTakeEdge!]!
  }

  input AddHotTakeInput {
    emoji: String!
    title: String!
    subtitle: String
  }

  input UpdateHotTakeInput {
    emoji: String
    title: String
    subtitle: String
  }

  input ReorderHotTakeInput {
    id: ID!
    position: Int!
  }

  extend type Query {
    """
    Get a user's hot takes
    """
    hotTakes(userId: ID!, first: Int, after: String): HotTakeConnection!

    """
    Discover random hot takes from other users for the tinder experience
    """
    discoverHotTakes(first: Int): [HotTake!]! @auth
  }

  extend type Mutation {
    """
    Add a hot take to the user's profile (max 5)
    """
    addHotTake(input: AddHotTakeInput!): HotTake! @auth

    """
    Update a hot take
    """
    updateHotTake(id: ID!, input: UpdateHotTakeInput!): HotTake! @auth

    """
    Delete a hot take
    """
    deleteHotTake(id: ID!): EmptyResponse! @auth

    """
    Reorder hot takes
    """
    reorderHotTakes(items: [ReorderHotTakeInput!]!): [HotTake!]! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    discoverHotTakes: async (
      _,
      args: { first?: number },
      ctx: AuthContext,
      info,
    ) => {
      const pageSize = args.first ?? 20;

      return graphorm.query(ctx, info, (builder) => {
        builder.queryBuilder
          .where(`"${builder.alias}"."userId" != :currentUserId`, {
            currentUserId: ctx.userId,
          })
          .andWhere(
            `NOT EXISTS (SELECT 1 FROM "user_hot_take" uht WHERE uht."hotTakeId" = "${builder.alias}"."id" AND uht."userId" = :currentUserId)`,
          )
          .orderBy('random()')
          .limit(pageSize);
        return builder;
      });
    },

    hotTakes: async (
      _,
      args: { userId: string; first?: number; after?: string },
      ctx: Context,
      info,
    ) => {
      const pageGenerator = offsetPageGenerator<GQLHotTake>(50, 100);
      const page = pageGenerator.connArgsToPage({
        first: args.first,
        after: args.after,
      });

      return graphorm.queryPaginated<GQLHotTake>(
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
    addHotTake: async (
      _,
      args: { input: AddUserHotTakeInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = addUserHotTakeSchema.parse(args.input);

      const count = await ctx.con.getRepository(HotTake).count({
        where: { userId: ctx.userId },
      });

      if (count >= MAX_HOT_TAKES) {
        throw new ValidationError(
          `Maximum of ${MAX_HOT_TAKES} hot takes allowed`,
        );
      }

      const hotTake = ctx.con.getRepository(HotTake).create({
        userId: ctx.userId,
        emoji: input.emoji,
        title: input.title,
        subtitle: input.subtitle || null,
        position: NEW_ITEM_POSITION,
      });

      await ctx.con.getRepository(HotTake).save(hotTake);

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: hotTake.id,
        });
        return builder;
      });
    },

    updateHotTake: async (
      _,
      args: { id: string; input: UpdateUserHotTakeInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = updateUserHotTakeSchema.parse(args.input);

      const hotTake = await ctx.con.getRepository(HotTake).findOne({
        where: { id: args.id, userId: ctx.userId },
      });

      if (!hotTake) {
        throw new ValidationError('Hot take not found');
      }

      const updateData: Partial<HotTake> = {};
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
          .getRepository(HotTake)
          .update({ id: args.id }, updateData);
      }

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: args.id,
        });
        return builder;
      });
    },

    deleteHotTake: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(HotTake)
        .delete({ id: args.id, userId: ctx.userId });

      return { _: true };
    },

    reorderHotTakes: async (
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
        .getRepository(HotTake)
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
