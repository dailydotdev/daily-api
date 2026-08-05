import { IResolvers } from '@graphql-tools/utils';
import { BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { DatasetTool } from '../entity/dataset/DatasetTool';
import { UserStack } from '../entity/user/UserStack';
import { User } from '../entity/user/User';
import { normalizeTitle } from '../common/datasetTool';

const MAX_ALSO_STACKED = 10;
const DEFAULT_ALSO_STACKED = 6;
const MAX_STACKERS = 10;
const DEFAULT_STACKERS = 5;

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
  },
};
