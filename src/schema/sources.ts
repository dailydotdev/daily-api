import { ForbiddenError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { ConnectionArguments } from 'graphql-relay';
import { traceResolverObject } from './trace';
import { Context } from '../Context';
import { Source, SourceFeed, SourceMember, SourceMemberRoles } from '../entity';
import {
  forwardPagination,
  PaginationResponse,
  offsetPageGenerator,
} from './common';
import graphorm from '../graphorm';
import { EntityNotFoundError } from 'typeorm';
import { GQLUser } from './users';
import { Connection } from 'graphql-relay/index';

export interface GQLSource {
  id: string;
  name: string;
  image: string;
  private: boolean;
  public: boolean;
  members?: Connection<GQLSourceMember>;
}

export interface GQLSourceMember {
  source: GQLSource;
  user: GQLUser;
  role: SourceMemberRoles;
}

export const typeDefs = /* GraphQL */ `
  """
  Source to discover posts from (usually blogs)
  """
  type Source {
    """
    Short unique string to identify the source
    """
    id: ID!

    """
    Source type (machine/squad)
    """
    type: String!

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

    """
    Whether the source is active or not (applicable for squads)
    """
    active: Boolean

    """
    Source handle (applicable for squads)
    """
    handle: String

    """
    Source description
    """
    description: String

    """
    Source members
    """
    members: SourceMemberConnection
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

  type SourceMember {
    """
    Relevant user who is part of the source
    """
    user: User!
    """
    Source the user belongs to
    """
    source: Source!
    """
    Role of this user in the source
    """
    role: String!
  }

  type SourceMemberConnection {
    pageInfo: PageInfo!
    edges: [SourceMemberEdge!]!
  }

  type SourceMemberEdge {
    node: SourceMember!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  input AddPrivateSourceInput {
    """
    RSS feed url
    """
    rss: String!
    """
    Name of the new source
    """
    name: String!
    """
    Thumbnail image of the source logo
    """
    image: String!
    """
    Url to the landing page of the source
    """
    website: String
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

    """
    Get the source that matches the feed
    """
    sourceByFeed(feed: String!): Source @auth

    """
    Get source by ID
    """
    source(id: ID!): Source
  }

  extend type Mutation {
    """
    Add a new private source
    """
    addPrivateSource(data: AddPrivateSourceInput!): Source! @auth(premium: true)
  }
`;

const sourceToGQL = (source: Source): GQLSource => ({
  ...source,
  public: !source.private,
  members: undefined,
});

const sourceByFeed = async (feed: string, ctx: Context): Promise<GQLSource> => {
  const res = await ctx.con
    .createQueryBuilder()
    .select('source.*')
    .from(Source, 'source')
    .innerJoin(SourceFeed, 'sf', 'source.id = sf."sourceId"')
    .where('sf.feed = :feed and source.private = false', { feed })
    .getRawOne();
  return res ? sourceToGQL(res) : null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Query: traceResolverObject<any, any>({
    sources: forwardPagination(
      async (
        source,
        args: ConnectionArguments,
        ctx,
        { limit, offset },
      ): Promise<PaginationResponse<GQLSource>> => {
        const res = await ctx.con.getRepository(Source).find({
          where: { active: true },
          order: { name: 'ASC' },
          take: limit,
          skip: offset,
        });
        return {
          nodes: res.map(sourceToGQL),
        };
      },
      offsetPageGenerator(100, 500),
    ),
    sourceByFeed: async (
      _,
      { feed }: { feed: string },
      ctx,
    ): Promise<GQLSource> => sourceByFeed(feed, ctx),
    source: async (
      _,
      { id }: { id: string },
      ctx,
      info,
    ): Promise<GQLSource> => {
      const res = await graphorm.query<GQLSource>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.andWhere({ id }).limit(1);
        return builder;
      });
      if (!res.length) {
        throw new EntityNotFoundError(Source, 'not found');
      }
      return res[0];
    },
  }),
  Mutation: traceResolverObject({
    addPrivateSource: async (): Promise<GQLSource> => {
      throw new ForbiddenError('Not available');
    },
  }),
  Source: {
    members: async (
      source: GQLSource,
      args,
      ctx,
    ): Promise<Connection<GQLSourceMember>> => {
      if (!source.private) {
        return source.members;
      }
      if (ctx.userId) {
        const member = await ctx.con.getRepository(SourceMember).findOneBy({
          userId: ctx.userId,
          sourceId: source.id,
        });
        if (member) {
          return source.members;
        }
      }
      return null;
    },
  },
};
