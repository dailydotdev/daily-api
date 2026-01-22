import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { offsetPageGenerator, GQLEmptyResponse } from './common';
import { DatasetTool } from '../entity/dataset/DatasetTool';
import { UserTool } from '../entity/user/UserTool';
import { ValidationError } from 'apollo-server-errors';
import type { DataSource } from 'typeorm';
import {
  addUserToolSchema,
  updateUserToolSchema,
  reorderUserToolSchema,
  type AddUserToolInput,
  type UpdateUserToolInput,
  type ReorderUserToolInput,
} from '../common/schema/userTool';
import { uploadToolIcon } from '../common/cloudinary';
import { Readable } from 'stream';

interface GQLUserTool {
  id: string;
  userId: string;
  toolId: string;
  category: string;
  position: number;
  createdAt: Date;
}

const NEW_ITEM_POSITION = 999999;
const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org';

const normalizeTitle = (title: string): string => title.toLowerCase().trim();

const toSimpleIconsSlug = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]/g, '');

const fetchAndUploadToolIcon = async (
  toolId: string,
  title: string,
): Promise<string | null> => {
  const slug = toSimpleIconsSlug(title);
  const url = `${SIMPLE_ICONS_CDN}/${slug}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const svgBuffer = Buffer.from(await response.arrayBuffer());
    const stream = Readable.from(svgBuffer);
    const result = await uploadToolIcon(toolId, stream);
    return result.url;
  } catch {
    return null;
  }
};

const findOrCreateDatasetTool = async (
  con: DataSource,
  title: string,
): Promise<DatasetTool> => {
  const titleNormalized = normalizeTitle(title);
  const repo = con.getRepository(DatasetTool);

  let tool = await repo.findOne({
    where: { titleNormalized },
  });

  if (!tool) {
    tool = repo.create({
      title: title.trim(),
      titleNormalized,
      faviconSource: 'none',
    });
    await repo.save(tool);

    const faviconUrl = await fetchAndUploadToolIcon(tool.id, title);
    if (faviconUrl) {
      tool.faviconUrl = faviconUrl;
      tool.faviconSource = 'simple-icons';
      await repo.save(tool);
    }
  }

  return tool;
};

export const typeDefs = /* GraphQL */ `
  type UserTool {
    id: ID!
    tool: DatasetTool!
    category: String!
    position: Int!
    createdAt: DateTime!
  }

  type UserToolEdge {
    node: UserTool!
    cursor: String!
  }

  type UserToolConnection {
    pageInfo: PageInfo!
    edges: [UserToolEdge!]!
  }

  input AddUserToolInput {
    title: String!
    category: String!
  }

  input UpdateUserToolInput {
    category: String
  }

  input ReorderUserToolInput {
    id: ID!
    position: Int!
  }

  extend type Query {
    """
    Get a user's tools
    """
    userTools(userId: ID!, first: Int, after: String): UserToolConnection!
  }

  extend type Mutation {
    """
    Add a tool to the user's profile (find-or-create in dataset)
    """
    addUserTool(input: AddUserToolInput!): UserTool! @auth

    """
    Update a user's tool
    """
    updateUserTool(id: ID!, input: UpdateUserToolInput!): UserTool! @auth

    """
    Delete a user's tool
    """
    deleteUserTool(id: ID!): EmptyResponse! @auth

    """
    Reorder user's tools
    """
    reorderUserTools(items: [ReorderUserToolInput!]!): [UserTool!]! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    userTools: async (
      _,
      args: { userId: string; first?: number; after?: string },
      ctx: Context,
      info,
    ) => {
      const pageGenerator = offsetPageGenerator<GQLUserTool>(50, 100);
      const page = pageGenerator.connArgsToPage({
        first: args.first,
        after: args.after,
      });

      return graphorm.queryPaginated<GQLUserTool>(
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
    addUserTool: async (
      _,
      args: { input: AddUserToolInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = addUserToolSchema.parse(args.input);

      const datasetTool = await findOrCreateDatasetTool(ctx.con, input.title);

      const existing = await ctx.con.getRepository(UserTool).findOne({
        where: {
          userId: ctx.userId,
          toolId: datasetTool.id,
        },
      });

      if (existing) {
        throw new ValidationError('Tool already exists in your profile');
      }

      const userTool = ctx.con.getRepository(UserTool).create({
        userId: ctx.userId,
        toolId: datasetTool.id,
        category: input.category,
        position: NEW_ITEM_POSITION,
      });

      await ctx.con.getRepository(UserTool).save(userTool);

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: userTool.id,
        });
        return builder;
      });
    },

    updateUserTool: async (
      _,
      args: { id: string; input: UpdateUserToolInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = updateUserToolSchema.parse(args.input);

      const userTool = await ctx.con.getRepository(UserTool).findOne({
        where: { id: args.id, userId: ctx.userId },
      });

      if (!userTool) {
        throw new ValidationError('Tool not found');
      }

      const updateData: Partial<UserTool> = {};
      if (input.category !== undefined) {
        updateData.category = input.category;
      }

      if (Object.keys(updateData).length > 0) {
        await ctx.con
          .getRepository(UserTool)
          .update({ id: args.id }, updateData);
      }

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: args.id,
        });
        return builder;
      });
    },

    deleteUserTool: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(UserTool)
        .delete({ id: args.id, userId: ctx.userId });

      return { _: true };
    },

    reorderUserTools: async (
      _,
      args: { items: ReorderUserToolInput[] },
      ctx: AuthContext,
      info,
    ) => {
      const items = reorderUserToolSchema.parse(args.items);
      const ids = items.map((i) => i.id);

      const whenClauses = items
        .map((item) => `WHEN id = '${item.id}' THEN ${item.position}`)
        .join(' ');

      await ctx.con
        .getRepository(UserTool)
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
