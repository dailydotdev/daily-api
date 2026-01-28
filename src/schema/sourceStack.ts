import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { offsetPageGenerator, GQLEmptyResponse } from './common';
import { SourceStack } from '../entity/sources/SourceStack';
import { ValidationError } from 'apollo-server-errors';
import {
  addSourceStackSchema,
  updateSourceStackSchema,
  reorderSourceStackSchema,
  type AddSourceStackInput,
  type UpdateSourceStackInput,
  type ReorderSourceStackInput,
} from '../common/schema/sourceStack';
import { findOrCreateDatasetTool } from '../common/datasetTool';
import { NEW_ITEM_POSITION } from '../common/constants';
import { ensureSourcePermissions, SourcePermissions } from './sources';
import { Source, SourceType } from '../entity/Source';

interface GQLSourceStack {
  id: string;
  sourceId: string;
  toolId: string;
  position: number;
  icon: string | null;
  title: string | null;
  createdAt: Date;
  createdById: string;
}

export const typeDefs = /* GraphQL */ `
  type SourceStack {
    id: ID!
    tool: DatasetTool!
    position: Int!
    icon: String
    title: String
    createdAt: DateTime!
    createdBy: User!
  }

  type SourceStackEdge {
    node: SourceStack!
    cursor: String!
  }

  type SourceStackConnection {
    pageInfo: PageInfo!
    edges: [SourceStackEdge!]!
  }

  input AddSourceStackInput {
    title: String!
  }

  input UpdateSourceStackInput {
    icon: String
    title: String
  }

  input ReorderSourceStackInput {
    id: ID!
    position: Int!
  }

  extend type Query {
    """
    Get a source's stack items
    """
    sourceStack(
      sourceId: ID!
      first: Int
      after: String
    ): SourceStackConnection!
  }

  extend type Mutation {
    """
    Add a stack item to a source (find-or-create in dataset)
    """
    addSourceStack(sourceId: ID!, input: AddSourceStackInput!): SourceStack!
      @auth

    """
    Update a source's stack item
    """
    updateSourceStack(id: ID!, input: UpdateSourceStackInput!): SourceStack!
      @auth

    """
    Delete a source's stack item
    """
    deleteSourceStack(id: ID!): EmptyResponse! @auth

    """
    Reorder source's stack items
    """
    reorderSourceStack(
      sourceId: ID!
      items: [ReorderSourceStackInput!]!
    ): [SourceStack!]! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    sourceStack: async (
      _,
      args: { sourceId: string; first?: number; after?: string },
      ctx: Context,
      info,
    ) => {
      // Verify view permission - this handles both public and private squads
      await ensureSourcePermissions(ctx, args.sourceId, SourcePermissions.View);

      const pageGenerator = offsetPageGenerator<GQLSourceStack>(50, 100);
      const page = pageGenerator.connArgsToPage({
        first: args.first,
        after: args.after,
      });

      return graphorm.queryPaginated<GQLSourceStack>(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          pageGenerator.nodeToCursor(page, { first: args.first }, node, index),
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."sourceId" = :sourceId`, {
              sourceId: args.sourceId,
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
    addSourceStack: async (
      _,
      args: { sourceId: string; input: AddSourceStackInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = addSourceStackSchema.parse(args.input);

      // First check if source is a Squad (before permission check for better error message)
      const sourceCheck = await ctx.con
        .getRepository(Source)
        .findOneByOrFail([{ id: args.sourceId }, { handle: args.sourceId }]);

      if (sourceCheck.type !== SourceType.Squad) {
        throw new ValidationError('Stack can only be added to Squads');
      }

      // Verify user has Edit permission on the source
      const source = await ensureSourcePermissions(
        ctx,
        args.sourceId,
        SourcePermissions.Edit,
      );

      const datasetTool = await findOrCreateDatasetTool(ctx.con, input.title);

      const existing = await ctx.con.getRepository(SourceStack).findOne({
        where: {
          sourceId: source.id,
          toolId: datasetTool.id,
        },
      });

      if (existing) {
        throw new ValidationError('Stack item already exists in this Squad');
      }

      const sourceStack = ctx.con.getRepository(SourceStack).create({
        sourceId: source.id,
        toolId: datasetTool.id,
        position: NEW_ITEM_POSITION,
        icon: null,
        title: null,
        createdById: ctx.userId,
      });

      await ctx.con.getRepository(SourceStack).save(sourceStack);

      // Return using GraphORM for consistent field resolution
      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: sourceStack.id,
        });
        return builder;
      });
    },

    updateSourceStack: async (
      _,
      args: { id: string; input: UpdateSourceStackInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = updateSourceStackSchema.parse(args.input);

      const sourceStack = await ctx.con.getRepository(SourceStack).findOne({
        where: { id: args.id },
      });

      if (!sourceStack) {
        throw new ValidationError('Stack item not found');
      }

      // Check if user has Edit permission on the source OR is the creator
      const hasEditPermission = await ctx.con
        .getRepository(SourceStack)
        .findOne({
          where: { id: args.id, createdById: ctx.userId },
        });

      if (!hasEditPermission) {
        // If not the creator, check for Edit permission
        await ensureSourcePermissions(
          ctx,
          sourceStack.sourceId,
          SourcePermissions.Edit,
        );
      }

      // Build update object
      const updateData: Partial<SourceStack> = {};
      if (input.icon !== undefined) {
        updateData.icon = input.icon || null;
      }
      if (input.title !== undefined) {
        updateData.title = input.title || null;
      }

      if (Object.keys(updateData).length > 0) {
        await ctx.con
          .getRepository(SourceStack)
          .update({ id: args.id }, updateData);
      }

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: args.id,
        });
        return builder;
      });
    },

    deleteSourceStack: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const sourceStack = await ctx.con.getRepository(SourceStack).findOne({
        where: { id: args.id },
      });

      if (!sourceStack) {
        throw new ValidationError('Stack item not found');
      }

      // Check if user is the creator
      const isCreator = sourceStack.createdById === ctx.userId;

      if (!isCreator) {
        // If not the creator, check for Edit permission
        await ensureSourcePermissions(
          ctx,
          sourceStack.sourceId,
          SourcePermissions.Edit,
        );
      }

      await ctx.con.getRepository(SourceStack).delete({ id: args.id });

      return { _: true };
    },

    reorderSourceStack: async (
      _,
      args: { sourceId: string; items: ReorderSourceStackInput[] },
      ctx: AuthContext,
      info,
    ) => {
      const items = reorderSourceStackSchema.parse(args.items);

      // Verify user has Edit permission on the source
      await ensureSourcePermissions(ctx, args.sourceId, SourcePermissions.Edit);

      const ids = items.map((i) => i.id);

      // Build CASE statement for bulk update
      const whenClauses = items
        .map((item) => `WHEN id = '${item.id}' THEN ${item.position}`)
        .join(' ');

      // Update all positions in a single query, only for items belonging to this source
      await ctx.con
        .getRepository(SourceStack)
        .createQueryBuilder()
        .update()
        .set({ position: () => `CASE ${whenClauses} ELSE position END` })
        .where('id IN (:...ids)', { ids })
        .andWhere('"sourceId" = :sourceId', { sourceId: args.sourceId })
        .execute();

      // Return updated items using GraphORM
      return graphorm.query(ctx, info, (builder) => {
        builder.queryBuilder
          .where(`"${builder.alias}"."id" IN (:...ids)`, { ids })
          .andWhere(`"${builder.alias}"."sourceId" = :sourceId`, {
            sourceId: args.sourceId,
          })
          .orderBy(`"${builder.alias}"."position"`, 'ASC');
        return builder;
      });
    },
  },
});
