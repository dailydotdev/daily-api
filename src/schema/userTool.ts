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
  searchToolSchema,
  addUserToolSchema,
  updateUserToolSchema,
  reorderUserToolSchema,
  type AddUserToolInput,
  type UpdateUserToolInput,
  type ReorderUserToolInput,
} from '../common/schema/userTool';
import { getGoogleFaviconUrl } from '../common/companyEnrichment';

interface GQLUserTool {
  id: string;
  userId: string;
  toolId: string;
  category: string;
  position: number;
  createdAt: Date;
}

const NEW_ITEM_POSITION = 999999;

const normalizeTitle = (title: string): string => title.toLowerCase().trim();

const extractDomainFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
};

const findOrCreateDatasetTool = async (
  con: DataSource,
  title: string,
  url?: string | null,
): Promise<DatasetTool> => {
  const titleNormalized = normalizeTitle(title);
  const repo = con.getRepository(DatasetTool);

  let tool = await repo.findOne({
    where: { titleNormalized },
  });

  if (!tool) {
    const domain = url ? extractDomainFromUrl(url) : null;
    const faviconUrl = domain ? getGoogleFaviconUrl(domain) : null;

    tool = repo.create({
      title: title.trim(),
      titleNormalized,
      url: url || null,
      faviconUrl,
      faviconSource: faviconUrl ? 'google' : 'none',
    });
    await repo.save(tool);
  } else if (url && !tool.faviconUrl) {
    // Update existing tool with favicon if it has a URL but no favicon
    const domain = extractDomainFromUrl(url);
    if (domain) {
      tool.faviconUrl = getGoogleFaviconUrl(domain);
      tool.faviconSource = 'google';
      if (!tool.url) {
        tool.url = url;
      }
      await repo.save(tool);
    }
  }

  return tool;
};

export const typeDefs = /* GraphQL */ `
  type DatasetTool {
    id: ID!
    title: String!
    url: String
    faviconUrl: String
  }

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
    url: String
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

    """
    Search the tools dataset for autocomplete
    """
    searchTools(query: String!): [DatasetTool!]!
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

    searchTools: async (_, args: { query: string }, ctx: Context) => {
      const result = searchToolSchema.safeParse(args);
      if (!result.success) {
        return [];
      }

      const results = await ctx.con
        .getRepository(DatasetTool)
        .createQueryBuilder('dt')
        .where('dt."titleNormalized" LIKE :query', {
          query: `%${result.data.query}%`,
        })
        .orderBy('dt."title"', 'ASC')
        .limit(10)
        .getMany();

      return results;
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

      const datasetTool = await findOrCreateDatasetTool(
        ctx.con,
        input.title,
        input.url,
      );

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
