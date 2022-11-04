import { ForbiddenError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { ConnectionArguments } from 'graphql-relay';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Source, SourceFeed } from '../entity';
import {
  forwardPagination,
  PaginationResponse,
  offsetPageGenerator,
} from './common';

export interface GQLSource {
  id: string;
  name: string;
  image: string;
  public: boolean;
}

export interface GQLAddPrivateSourceInput {
  rss: string;
  name: string;
  image: string;
  website?: string;
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
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
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
    source: async (_, { id }: { id: string }, ctx): Promise<GQLSource> => {
      const res = await ctx.con
        .getRepository(Source)
        .findOneByOrFail({ id, private: false });
      return sourceToGQL(res);
    },
  },
  Mutation: {
    addPrivateSource: async (): Promise<GQLSource> => {
      throw new ForbiddenError('Not available');
      // const privateCount = await ctx
      //   .getRepository(SourceDisplay)
      //   .count({ userId: ctx.userId });
      // if (privateCount >= 40) {
      //   throw new ForbiddenError('Private sources cap reached');
      // }
      // let display = await sourceByFeed(data.rss, ctx);
      // if (display) {
      //   return display;
      // }
      // const feed = data.rss;
      // const existingFeed = await ctx
      //   .getRepository(SourceFeed)
      //   .findOne({ select: ['sourceId'], where: { feed } });
      // const id = existingFeed
      //   ? existingFeed.sourceId
      //   : uuidv4().replace(/-/g, '');
      // display = await ctx.con.transaction(async (manager) => {
      //   if (!existingFeed) {
      //     await manager
      //       .getRepository(Source)
      //       .save({ id, website: data.website });
      //     await manager.getRepository(SourceFeed).save({ sourceId: id, feed });
      //   } else {
      //     ctx.log.info({ data: { id } }, 'using existing private source');
      //   }
      //   const display = await manager.getRepository(SourceDisplay).save({
      //     sourceId: id,
      //     image: data.image,
      //     name: data.name,
      //     userId: ctx.userId,
      //   });
      //   return sourceToGQL(display);
      // });
      // if (!existingFeed) {
      //   await pRetry(
      //     () => addOrRemoveSuperfeedrSubscription(feed, id, 'subscribe'),
      //     { retries: 2 },
      //   ).catch((err) =>
      //     ctx.log.error(
      //       { err, data: { feed, id } },
      //       'failed to add rss to superfeedr',
      //     ),
      //   );
      // }
      // ctx.log.info({ data }, 'new private source added');
      // return display;
    },
  },
});
