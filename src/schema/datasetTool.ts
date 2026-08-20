import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { DatasetTool } from '../entity/dataset/DatasetTool';
import { UserStack } from '../entity/user/UserStack';
import { User } from '../entity/user/User';
import { HotTake } from '../entity/user/HotTake';
import { ContentPreference } from '../entity/contentPreference/ContentPreference';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import {
  createToolDiscussionPost,
  ensureVerifiedForToolDiscussion,
  normalizeTitle,
} from '../common/datasetTool';
import { queryReadReplica } from '../common/queryReadReplica';
import { ToolStackStats } from '../entity/ToolStackStats';
import { ToolVote } from '../entity/ToolVote';
import { UserVote } from '../types';
import { voteToolSchema } from '../common/schema/toolDiscussion';
import { GQLEmptyResponse } from './common';
import { NotFoundError } from '../errors';

const MAX_ALSO_STACKED = 10;
const DEFAULT_ALSO_STACKED = 6;
const MAX_ALTERNATIVES = 20;
const DEFAULT_ALTERNATIVES = 6;
const MAX_TOP_TOOLS = 24;
const DEFAULT_TOP_TOOLS = 6;
const MAX_STACKERS = 10;
const DEFAULT_STACKERS = 5;
const MAX_TAKES = 5;
const DEFAULT_TAKES = 3;
// Short titles ("Go", "C") match everywhere; only surface takes for
// distinctive tool names.
const MIN_TAKE_MATCH_LENGTH = 4;

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Rolls back initToolDiscussion's transaction when it loses a concurrent race.
class ToolDiscussionRaceError extends Error {}

export const typeDefs = /* GraphQL */ `
  extend type DatasetTool {
    """
    URL-safe unique identifier (normalized title)
    """
    slug: String!

    """
    Tool website
    """
    url: String

    """
    Directory category, if curated
    """
    category: String

    """
    Number of user stacks that include this tool
    """
    stackCount: Int!

    """
    Allowed content keyword matching this tool, if any
    """
    keyword: String

    """
    Number of upvotes on the tool
    """
    upvotes: Int!

    """
    Number of downvotes on the tool
    """
    downvotes: Int!

    """
    The viewer's vote on the tool (1, 0, -1)
    """
    userVote: Int

    """
    Hidden post hosting the tool's discussion, once initialized
    """
    discussionPostId: ID

    """
    The tool's official source/squad on daily.dev, if curated
    """
    officialSource: Source
  }

  extend type Query {
    """
    Get a tool from the dataset by its slug
    """
    datasetTool(slug: String!): DatasetTool!

    """
    Tools that most often appear in the same stacks as the given tool
    """
    toolsAlsoStacked(id: ID!, first: Int): [DatasetTool!]!

    """
    Tools in the same category as the given tool, ranked by stack count
    """
    toolAlternatives(id: ID!, first: Int): [DatasetTool!]!

    """
    Users who have the tool in their stack, highest reputation first
    """
    toolStackers(id: ID!, first: Int): [User!]!

    """
    Users the viewer follows who have the tool in their stack
    """
    toolStackersFollowing(id: ID!, first: Int): [User!]! @auth

    """
    Stack adoption stats for the tool on daily.dev
    """
    toolAdoption(id: ID!): ToolAdoption!

    """
    Hot takes mentioning the tool, most upvoted first
    """
    toolTakes(id: ID!, first: Int): [HotTake!]!

    """
    Most stacked tools, optionally within a category or by recent additions
    """
    topTools(first: Int, category: String, trending: Boolean): [DatasetTool!]!

    """
    Curated tool categories ordered by total stack presence
    """
    toolCategories: [ToolCategoryStat!]!
  }

  extend type Mutation {
    """
    Vote on a tool (1 up, -1 down, 0 to clear)
    """
    voteTool(id: ID!, vote: Int!): EmptyResponse! @auth

    """
    Get or create the tool's hidden discussion post; comments on it are
    ordinary post comments
    """
    initToolDiscussion(id: ID!): ID! @auth @rateLimit(limit: 1, duration: 30)
  }

  type ToolCategoryStat {
    category: String!
    toolCount: Int!
  }

  type ToolAdoptionPoint {
    date: DateTime!
    count: Int!
  }

  type ToolAdoption {
    """
    Total stacks including the tool
    """
    stackCount: Int!

    """
    Share of stacked tools with fewer stacks than this one (0-1)
    """
    percentile: Float

    """
    Stack additions in the last quarter relative to the base before it, in percent
    """
    quarterGrowth: Float

    """
    Stack additions per month, trailing 12 months
    """
    monthly: [ToolAdoptionPoint!]!
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    datasetTool: async (
      _,
      args: { slug: string },
      ctx: Context,
      info,
    ): Promise<DatasetTool> =>
      graphorm.queryOneOrFail<DatasetTool>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where(
            `"${builder.alias}"."titleNormalized" = :slug`,
            { slug: normalizeTitle(args.slug) },
          );
          return builder;
        },
        DatasetTool,
        true,
      ),

    toolsAlsoStacked: async (
      _,
      args: { id: string; first?: number },
      ctx: Context,
      info,
    ): Promise<DatasetTool[]> => {
      const first = Math.min(
        args.first ?? DEFAULT_ALSO_STACKED,
        MAX_ALSO_STACKED,
      );

      return graphorm.query<DatasetTool>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .innerJoin(
              (qb) =>
                qb
                  .select('us."toolId"', 'toolId')
                  .addSelect('COUNT(*)', 'cnt')
                  .from(UserStack, 'us')
                  .where(
                    `us."userId" IN (SELECT "userId" FROM user_stack WHERE "toolId" = :toolId)`,
                  )
                  .andWhere('us."toolId" != :toolId')
                  .groupBy('us."toolId"'),
              'co',
              `co."toolId" = "${builder.alias}"."id"`,
            )
            .setParameter('toolId', args.id)
            .orderBy('co."cnt"', 'DESC')
            .addOrderBy(`"${builder.alias}"."title"`, 'ASC')
            .limit(first);
          return builder;
        },
        true,
      );
    },

    toolAlternatives: async (
      _,
      args: { id: string; first?: number },
      ctx: Context,
      info,
    ): Promise<DatasetTool[]> => {
      const first = Math.min(
        args.first ?? DEFAULT_ALTERNATIVES,
        MAX_ALTERNATIVES,
      );

      // Comparing against a subquery that returns NULL (no category, or the
      // tool doesn't exist) never matches, so both edge cases naturally
      // yield [] without a separate existence check.
      return graphorm.query<DatasetTool>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .innerJoin(
              ToolStackStats,
              'alt',
              `alt."toolId" = "${builder.alias}"."id"`,
            )
            .where(
              `"${builder.alias}"."category" = (SELECT category FROM dataset_tool WHERE id = :id)`,
            )
            .andWhere(`"${builder.alias}"."id" != :id`, { id: args.id })
            .setParameter('id', args.id)
            .orderBy('alt."stackCount"', 'DESC')
            .addOrderBy(`"${builder.alias}"."title"`, 'ASC')
            .limit(first);
          return builder;
        },
        true,
      );
    },

    toolStackers: async (
      _,
      args: { id: string; first?: number },
      ctx: Context,
      info,
    ): Promise<User[]> => {
      const first = Math.min(args.first ?? DEFAULT_STACKERS, MAX_STACKERS);

      return graphorm.query<User>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .innerJoin(
              UserStack,
              'us',
              `us."userId" = "${builder.alias}"."id" AND us."toolId" = :toolId`,
              { toolId: args.id },
            )
            .orderBy(`"${builder.alias}"."reputation"`, 'DESC')
            .limit(first);
          return builder;
        },
        true,
      );
    },

    toolStackersFollowing: async (
      _,
      args: { id: string; first?: number },
      ctx: AuthContext,
      info,
    ): Promise<User[]> => {
      const first = Math.min(args.first ?? DEFAULT_STACKERS, MAX_STACKERS);

      return graphorm.query<User>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .innerJoin(
              UserStack,
              'us',
              `us."userId" = "${builder.alias}"."id" AND us."toolId" = :toolId`,
              { toolId: args.id },
            )
            .innerJoin(
              ContentPreference,
              'cp',
              `cp."referenceId" = "${builder.alias}"."id" AND cp."userId" = :viewerId AND cp."type" = :cpType AND cp."status" IN (:...cpStatuses)`,
              {
                viewerId: ctx.userId,
                cpType: ContentPreferenceType.User,
                cpStatuses: [
                  ContentPreferenceStatus.Follow,
                  ContentPreferenceStatus.Subscribed,
                ],
              },
            )
            .orderBy(`"${builder.alias}"."reputation"`, 'DESC')
            .limit(first);
          return builder;
        },
        true,
      );
    },

    toolAdoption: async (_, args: { id: string }, ctx: Context) =>
      queryReadReplica(ctx.con, async ({ queryRunner }) => {
        const statsRepo = queryRunner.manager.getRepository(ToolStackStats);
        const stats = await statsRepo.findOneBy({ toolId: args.id });
        const stackCount = Number(stats?.stackCount) || 0;
        const recentCount = Number(stats?.recentCount) || 0;

        const [monthlyRaw, totalsRaw] = await Promise.all([
          queryRunner.manager
            .getRepository(UserStack)
            .createQueryBuilder('us')
            .select(`date_trunc('month', us."createdAt")`, 'date')
            .addSelect('COUNT(*)', 'count')
            .where('us."toolId" = :id', { id: args.id })
            .andWhere(`us."createdAt" >= now() - interval '12 months'`)
            .groupBy(`date_trunc('month', us."createdAt")`)
            .orderBy(`date_trunc('month', us."createdAt")`, 'ASC')
            .getRawMany<{ date: Date; count: string }>(),
          statsRepo
            .createQueryBuilder('t')
            .select('COUNT(*)', 'total')
            .addSelect('COUNT(*) FILTER (WHERE t."stackCount" < :my)', 'lower')
            .setParameter('my', stackCount)
            .getRawOne<{ total: string; lower: string }>(),
        ]);

        const total = Number(totalsRaw?.total) || 0;
        const growthBase = stackCount - recentCount;

        return {
          stackCount,
          percentile:
            total > 0 && stackCount > 0
              ? Number(totalsRaw?.lower) / total
              : null,
          quarterGrowth:
            growthBase > 0 ? (recentCount / growthBase) * 100 : null,
          monthly: monthlyRaw.map((row) => ({
            date: row.date,
            count: Number(row.count),
          })),
        };
      }),

    toolTakes: async (
      _,
      args: { id: string; first?: number },
      ctx: Context,
      info,
    ): Promise<HotTake[]> => {
      const first = Math.min(args.first ?? DEFAULT_TAKES, MAX_TAKES);

      const tool = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(DatasetTool)
          .findOneBy({ id: args.id }),
      );

      const title = tool?.title?.trim();
      if (!title || title.length < MIN_TAKE_MATCH_LENGTH) {
        return [];
      }

      const pattern = `\\m${escapeRegex(title)}\\M`;

      return graphorm.query<HotTake>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."title" ~* :pattern`, { pattern })
            .orderBy(`"${builder.alias}"."upvotes"`, 'DESC')
            .addOrderBy(`"${builder.alias}"."createdAt"`, 'DESC')
            .limit(first);
          return builder;
        },
        true,
      );
    },

    topTools: async (
      _,
      args: { first?: number; category?: string; trending?: boolean },
      ctx: Context,
      info,
    ): Promise<DatasetTool[]> => {
      const first = Math.min(args.first ?? DEFAULT_TOP_TOOLS, MAX_TOP_TOOLS);

      const rankColumn = args.trending ? 'recentCount' : 'stackCount';

      return graphorm.query<DatasetTool>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .innerJoin(
              ToolStackStats,
              'top',
              `top."toolId" = "${builder.alias}"."id"`,
            )
            .where(`top."${rankColumn}" > 0`)
            .orderBy(`top."${rankColumn}"`, 'DESC')
            .addOrderBy(`"${builder.alias}"."title"`, 'ASC')
            .limit(first);

          if (args.category) {
            builder.queryBuilder.andWhere(
              `"${builder.alias}"."category" = :category`,
              { category: args.category },
            );
          }
          return builder;
        },
        true,
      );
    },

    toolCategories: async (_, __, ctx: Context) =>
      queryReadReplica(ctx.con, async ({ queryRunner }) => {
        const rows = await queryRunner.manager
          .getRepository(DatasetTool)
          .createQueryBuilder('dt')
          .select('dt."category"', 'category')
          .addSelect('COUNT(DISTINCT dt."id")', 'toolCount')
          .addSelect('COALESCE(SUM(t."stackCount"), 0)', 'stacks')
          .leftJoin(ToolStackStats, 't', 't."toolId" = dt."id"')
          .where('dt."category" IS NOT NULL')
          .groupBy('dt."category"')
          .orderBy('"stacks"', 'DESC')
          .getRawMany<{ category: string; toolCount: string }>();

        return rows.map((row) => ({
          category: row.category,
          toolCount: Number(row.toolCount),
        }));
      }),
  },

  Mutation: {
    voteTool: async (
      _,
      args: { id: string; vote: number },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { id, vote } = voteToolSchema.parse(args);

      const tool = await ctx.con.getRepository(DatasetTool).findOneBy({ id });
      if (!tool) {
        throw new NotFoundError('Tool not found');
      }

      if (vote === UserVote.None) {
        await ctx.con
          .getRepository(ToolVote)
          .delete({ userId: ctx.userId, toolId: id });
      } else {
        await ctx.con
          .getRepository(ToolVote)
          .upsert(
            { userId: ctx.userId, toolId: id, vote },
            { conflictPaths: ['userId', 'toolId'] },
          );
      }

      return { _: true };
    },

    initToolDiscussion: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<string> => {
      const tool = await ctx.con
        .getRepository(DatasetTool)
        .findOneBy({ id: args.id });
      if (!tool) {
        throw new NotFoundError('Tool not found');
      }
      await ensureVerifiedForToolDiscussion(ctx.con, ctx.userId);
      if (tool.discussionPostId) {
        return tool.discussionPostId;
      }

      try {
        return await ctx.con.transaction(async (manager) => {
          const post = await createToolDiscussionPost(manager, tool);
          const claimed = await manager
            .getRepository(DatasetTool)
            .createQueryBuilder()
            .update()
            .set({ discussionPostId: post.id })
            .where('id = :id AND "discussionPostId" IS NULL', { id: tool.id })
            .execute();

          if (!claimed.affected) {
            // Lost a concurrent init; roll back this post and use the winner's.
            throw new ToolDiscussionRaceError();
          }

          return post.id;
        });
      } catch (error) {
        if (!(error instanceof ToolDiscussionRaceError)) {
          throw error;
        }
      }

      const fresh = await ctx.con
        .getRepository(DatasetTool)
        .findOneByOrFail({ id: tool.id });
      if (!fresh.discussionPostId) {
        throw new Error('Failed to initialize tool discussion');
      }
      return fresh.discussionPostId;
    },
  },
};
