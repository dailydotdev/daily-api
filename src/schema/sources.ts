import { gql, IResolvers, ForbiddenError } from 'apollo-server-fastify';
import { ConnectionArguments } from 'graphql-relay';
import { SelectQueryBuilder } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import pRetry from 'p-retry';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { SourceDisplay, Source, SourceFeed } from '../entity';
import {
  forwardPagination,
  PaginationResponse,
  GQLDataInput,
  offsetPageGenerator,
} from './common';
import { addOrRemoveSuperfeedrSubscription } from '../common';

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
  }

  extend type Mutation {
    """
    Add a new private source
    """
    addPrivateSource(data: AddPrivateSourceInput!): Source! @auth(premium: true)
  }
`;

const sourceFromDisplay = (display: SourceDisplay): GQLSource => ({
  id: display.sourceId,
  name: display.name,
  image: display.image,
  public: !display.userId,
});

const fromSourceDisplay = (
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

const sourceByFeed = async (feed: string, ctx: Context): Promise<GQLSource> => {
  const res = await ctx.con
    .createQueryBuilder()
    .select('sd.*')
    .from(fromSourceDisplay, 'sd')
    .innerJoin(SourceFeed, 'sf', 'sd."sourceId" = sf."sourceId"')
    .where('sf.feed = :feed', { feed })
    .setParameters({ userId: ctx.userId, enabled: true })
    .getRawOne();
  return res ? sourceFromDisplay(res) : null;
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
        const res = await ctx.con
          .createQueryBuilder()
          .select('sd.*')
          .from(fromSourceDisplay, 'sd')
          .setParameters({ userId: ctx.userId, enabled: true })
          .orderBy('sd.name', 'ASC')
          .limit(limit)
          .offset(offset)
          .getRawMany();

        return {
          nodes: res.map(sourceFromDisplay),
        };
      },
      offsetPageGenerator(100, 500),
    ),
    sourceByFeed: async (
      _,
      { feed }: { feed: string },
      ctx,
    ): Promise<GQLSource> => sourceByFeed(feed, ctx),
  },
  Mutation: {
    addPrivateSource: async (
      _,
      { data }: GQLDataInput<GQLAddPrivateSourceInput>,
      ctx,
    ): Promise<GQLSource> => {
      const privateCount = await ctx
        .getRepository(SourceDisplay)
        .count({ userId: ctx.userId });
      if (privateCount >= 20) {
        throw new ForbiddenError('Private sources cap reached');
      }
      let display = await sourceByFeed(data.rss, ctx);
      if (display) {
        return display;
      }
      const feed = data.rss;
      const existingFeed = await ctx
        .getRepository(SourceFeed)
        .findOne({ select: ['sourceId'], where: { feed } });
      const id = existingFeed
        ? existingFeed.sourceId
        : uuidv4().replace(/-/g, '');
      display = await ctx.con.transaction(async (manager) => {
        if (!existingFeed) {
          await manager
            .getRepository(Source)
            .save({ id, website: data.website });
          await manager.getRepository(SourceFeed).save({ sourceId: id, feed });
        } else {
          ctx.log.info({ data: { id } }, 'using existing private source');
        }
        const display = await manager.getRepository(SourceDisplay).save({
          sourceId: id,
          image: data.image,
          name: data.name,
          userId: ctx.userId,
        });
        return sourceFromDisplay(display);
      });
      if (!existingFeed) {
        await pRetry(
          () => addOrRemoveSuperfeedrSubscription(feed, id, 'subscribe'),
          { retries: 2 },
        ).catch((err) =>
          ctx.log.error(
            { err, data: { feed, id } },
            'failed to add rss to superfeedr',
          ),
        );
      }
      ctx.log.info({ data }, 'new private source added');
      return display;
    },
  },
});
