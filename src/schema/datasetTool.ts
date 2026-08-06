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
import { normalizeTitle } from '../common/datasetTool';
import { queryReadReplica } from '../common/queryReadReplica';

const MAX_ALSO_STACKED = 10;
const DEFAULT_ALSO_STACKED = 6;
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
        const repo = queryRunner.manager.getRepository(UserStack);
        const stackCount = await repo.count({ where: { toolId: args.id } });

        const [recentCount, monthlyRaw, totalsRaw] = await Promise.all([
          repo
            .createQueryBuilder('us')
            .where('us."toolId" = :id', { id: args.id })
            .andWhere(`us."createdAt" >= now() - interval '90 days'`)
            .getCount(),
          repo
            .createQueryBuilder('us')
            .select(`date_trunc('month', us."createdAt")`, 'date')
            .addSelect('COUNT(*)', 'count')
            .where('us."toolId" = :id', { id: args.id })
            .andWhere(`us."createdAt" >= now() - interval '12 months'`)
            .groupBy(`date_trunc('month', us."createdAt")`)
            .orderBy(`date_trunc('month', us."createdAt")`, 'ASC')
            .getRawMany<{ date: Date; count: string }>(),
          queryRunner.manager
            .createQueryBuilder()
            .select('COUNT(*)', 'total')
            .addSelect('COUNT(*) FILTER (WHERE t."cnt" < :my)', 'lower')
            .from(
              (qb) =>
                qb
                  .select('us."toolId"', 'toolId')
                  .addSelect('COUNT(*)', 'cnt')
                  .from(UserStack, 'us')
                  .groupBy('us."toolId"'),
              't',
            )
            .setParameter('my', stackCount)
            .getRawOne<{ total: string; lower: string }>(),
        ]);

        const total = Number(totalsRaw?.total) || 0;
        const growthBase = stackCount - recentCount;

        return {
          stackCount,
          percentile: total > 0 ? Number(totalsRaw?.lower) / total : null,
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

      return graphorm.query<DatasetTool>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .innerJoin(
              (qb) => {
                const counts = qb
                  .select('us."toolId"', 'toolId')
                  .addSelect('COUNT(*)', 'cnt')
                  .from(UserStack, 'us')
                  .groupBy('us."toolId"');
                if (args.trending) {
                  counts.where(`us."createdAt" >= now() - interval '90 days'`);
                }
                return counts;
              },
              'top',
              `top."toolId" = "${builder.alias}"."id"`,
            )
            .orderBy('top."cnt"', 'DESC')
            .addOrderBy(`"${builder.alias}"."title"`, 'ASC')
            .limit(first);

          if (args.category) {
            builder.queryBuilder.where(
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
          .addSelect('COUNT(us."id")', 'stacks')
          .leftJoin(UserStack, 'us', 'us."toolId" = dt."id"')
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
};
