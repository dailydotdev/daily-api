import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { offsetPageGenerator, GQLEmptyResponse } from './common';
import { UserStack } from '../entity/user/UserStack';
import { ValidationError } from 'apollo-server-errors';
import { In } from 'typeorm';
import {
  addUserStackSchema,
  updateUserStackSchema,
  reorderUserStackSchema,
  type AddUserStackInput,
  type UpdateUserStackInput,
  type ReorderUserStackInput,
} from '../common/schema/userStack';
import { findOrCreateDatasetTool } from '../common/datasetTool';
import { MAX_STACK_ITEMS, NEW_ITEM_POSITION } from '../common/constants';

interface GQLUserStack {
  id: string;
  userId: string;
  toolId: string;
  section: string;
  position: number;
  startedAt: Date | null;
  icon: string | null;
  title: string | null;
  createdAt: Date;
}

export const typeDefs = /* GraphQL */ `
  type UserStack {
    id: ID!
    tool: DatasetTool!
    section: String!
    position: Int!
    startedAt: DateTime
    icon: String
    title: String
    createdAt: DateTime!
  }

  type UserStackEdge {
    node: UserStack!
    cursor: String!
  }

  type UserStackConnection {
    pageInfo: PageInfo!
    edges: [UserStackEdge!]!
  }

  input AddUserStackInput {
    title: String!
    section: String!
    startedAt: DateTime
  }

  input UpdateUserStackInput {
    section: String
    icon: String
    title: String
    startedAt: DateTime
  }

  input ReorderUserStackInput {
    id: ID!
    position: Int!
    section: String
  }

  extend type Query {
    """
    Get a user's stack items
    """
    userStack(userId: ID!, first: Int, after: String): UserStackConnection!
  }

  extend type Mutation {
    """
    Add a stack item to the user's profile (find-or-create in dataset)
    """
    addUserStack(input: AddUserStackInput!): UserStack! @auth

    """
    Update a user's stack item
    """
    updateUserStack(id: ID!, input: UpdateUserStackInput!): UserStack! @auth

    """
    Delete a user's stack item
    """
    deleteUserStack(id: ID!): EmptyResponse! @auth

    """
    Reorder user's stack items
    """
    reorderUserStack(items: [ReorderUserStackInput!]!): [UserStack!]! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    userStack: async (
      _,
      args: { userId: string; first?: number; after?: string },
      ctx: Context,
      info,
    ) => {
      const pageGenerator = offsetPageGenerator<GQLUserStack>(50, 100);
      const page = pageGenerator.connArgsToPage({
        first: args.first,
        after: args.after,
      });

      return graphorm.queryPaginated<GQLUserStack>(
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
        true, // use read replica
      );
    },
  },

  Mutation: {
    addUserStack: async (
      _,
      args: { input: AddUserStackInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = addUserStackSchema.parse(args.input);

      const datasetTool = await findOrCreateDatasetTool(ctx.con, input.title);

      const existing = await ctx.con.getRepository(UserStack).findOne({
        where: {
          userId: ctx.userId,
          toolId: datasetTool.id,
        },
      });

      if (existing) {
        throw new ValidationError('Stack item already exists in your profile');
      }

      const count = await ctx.con.getRepository(UserStack).count({
        where: { userId: ctx.userId },
      });
      if (count >= MAX_STACK_ITEMS) {
        throw new ValidationError(
          `You can have a maximum of ${MAX_STACK_ITEMS} items in your stack`,
        );
      }

      const userStack = ctx.con.getRepository(UserStack).create({
        userId: ctx.userId,
        toolId: datasetTool.id,
        section: input.section,
        position: NEW_ITEM_POSITION,
        startedAt: input.startedAt ? new Date(input.startedAt) : null,
        icon: null,
        title: null,
      });

      await ctx.con.getRepository(UserStack).save(userStack);

      // Return using GraphORM for consistent field resolution
      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: userStack.id,
        });
        return builder;
      });
    },

    updateUserStack: async (
      _,
      args: { id: string; input: UpdateUserStackInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = updateUserStackSchema.parse(args.input);

      const userStack = await ctx.con.getRepository(UserStack).findOne({
        where: { id: args.id, userId: ctx.userId },
      });

      if (!userStack) {
        throw new ValidationError('Stack item not found');
      }

      // Build update object
      const updateData: Partial<UserStack> = {};
      if (input.section !== undefined) {
        updateData.section = input.section;
      }
      if (input.startedAt !== undefined) {
        updateData.startedAt = input.startedAt
          ? new Date(input.startedAt)
          : null;
      }
      if (input.icon !== undefined) {
        updateData.icon = input.icon || null;
      }
      if (input.title !== undefined) {
        updateData.title = input.title || null;
      }

      if (Object.keys(updateData).length > 0) {
        await ctx.con
          .getRepository(UserStack)
          .update({ id: args.id }, updateData);
      }

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: args.id,
        });
        return builder;
      });
    },

    deleteUserStack: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(UserStack)
        .delete({ id: args.id, userId: ctx.userId });

      return { _: true };
    },

    reorderUserStack: async (
      _,
      args: { items: ReorderUserStackInput[] },
      ctx: AuthContext,
      info,
    ) => {
      const items = reorderUserStackSchema.parse(args.items);
      const ids = items.map((i) => i.id);
      const itemsById = new Map(items.map((item) => [item.id, item]));

      await ctx.con.transaction(async (transactionalEntityManager) => {
        const existingItems = await transactionalEntityManager
          .getRepository(UserStack)
          .find({
            where: {
              userId: ctx.userId,
              id: In(ids),
            },
          });

        if (existingItems.length !== ids.length) {
          throw new ValidationError('One or more stack items were not found');
        }

        const updatedItems = existingItems.map((item) => {
          const nextItem = itemsById.get(item.id);
          if (!nextItem) {
            throw new ValidationError(
              `Missing reorder payload for stack item ${item.id}`,
            );
          }

          item.position = nextItem.position;
          if (nextItem.section !== undefined) {
            item.section = nextItem.section;
          }

          return item;
        });

        await transactionalEntityManager
          .getRepository(UserStack)
          .save(updatedItems);
      });

      // Return updated items using GraphORM
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
};
