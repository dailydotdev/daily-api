import { gql, IResolvers } from 'apollo-server-fastify';
import { ConnectionArguments } from 'graphql-relay';
import { SelectQueryBuilder } from 'typeorm';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { SourceDisplay } from '../entity';
import { forwardPagination, PaginationResponse } from './common';

export interface GQLSource {
  id: string;
  name: string;
  image: string;
  public: boolean;
}

export const typeDefs = gql`
  """
  Source to discover posts from (usually blogs)
  """
  type Source {
    """
    Short unique string to identify the source
    """
    id: ID!

    """
    Name of the source
    """
    name: String!

    """
    URL to a thumbnail image of the source
    """
    image: String!

    """
    Whether the source is public
    """
    public: Boolean
  }

  type SourceConnection {
    pageInfo: PageInfo!
    edges: [SourceEdge!]!
  }

  type SourceEdge {
    node: Source!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  extend type Query {
    """
    Get all available sources
    """
    sources(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): SourceConnection!
  }
`;

const sourceFromDisplay = (display: SourceDisplay): GQLSource => ({
  id: display.sourceId,
  name: display.name,
  image: display.image,
  public: !display.userId,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    sources: forwardPagination(
      async (
        source,
        args: ConnectionArguments,
        ctx,
        { limit, offset },
      ): Promise<PaginationResponse<GQLSource>> => {
        const from = (
          builder: SelectQueryBuilder<SourceDisplay>,
        ): SelectQueryBuilder<SourceDisplay> =>
          builder
            .distinctOn(['sd.sourceId'])
            .addSelect('sd.*')
            .from(SourceDisplay, 'sd')
            .orderBy('sd.sourceId')
            .addOrderBy('sd.userId', 'ASC', 'NULLS LAST')
            .where('"sd"."userId" IS NULL OR "sd"."userId" = :userId')
            .andWhere('"sd"."enabled" = :enabled');

        const res = await ctx.con
          .createQueryBuilder()
          .select('sd.*')
          .addSelect('count(*) OVER() AS count')
          .from(from, 'sd')
          .setParameters({ userId: ctx.userId, enabled: true })
          .orderBy('sd.name', 'ASC')
          .limit(limit)
          .offset(offset)
          .getRawMany();

        return {
          count: parseInt(res?.[0].count || 0),
          nodes: res.map(sourceFromDisplay),
        };
      },
      100,
    ),
  },
});
