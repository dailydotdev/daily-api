import { gql, IResolvers } from 'apollo-server-fastify';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import {
  anonymousFeedBuilder,
  AnonymousFeedFilters,
  configuredFeedBuilder,
  FeedArgs,
  feedResolver,
  nestChild,
  searchPostFeedBuilder,
  selectSource,
  sourceFeedBuilder,
  tagFeedBuilder,
} from '../common';
import { In } from 'typeorm';
import { Feed, FeedTag, searchPosts } from '../entity';
import { GQLSource } from './sources';
import { FeedSource } from '../entity/FeedSource';
import { forwardPagination } from './common';

export const typeDefs = gql`
  type FeedSettings {
    id: String
    userId: String
    includeTags: [String]
    excludeSources: [Source]
  }

  type SearchPostSuggestion {
    title: String!
  }

  type SearchPostSuggestionsResults {
    query: String!
    hits: [SearchPostSuggestion!]!
  }

  enum Ranking {
    """
    Rank by a combination of time and views
    """
    POPULARITY
    """
    Rank by time only
    """
    TIME
  }

  input FiltersInput {
    """
    Include posts of these sources
    """
    includeSources: [ID!]

    """
    Exclude posts of these sources
    """
    excludeSources: [ID!]

    """
    Posts must include at least one tag from this list
    """
    includeTags: [String!]
  }

  extend type Query {
    """
    Get an ad-hoc feed based on sources and tags filters
    """
    anonymousFeed(
      """
      Time the pagination started to ignore new items
      """
      now: DateTime!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Ranking criteria for the feed
      """
      ranking: Ranking = POPULARITY

      """
      Filters to apply to the feed
      """
      filters: FiltersInput
    ): PostConnection!

    """
    Get a configured feed
    """
    feed(
      """
      Time the pagination started to ignore new items
      """
      now: DateTime!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Ranking criteria for the feed
      """
      ranking: Ranking = POPULARITY

      """
      Return only unread posts
      """
      unreadOnly: Boolean = false
    ): PostConnection! @auth

    """
    Get a single source feed
    """
    sourceFeed(
      """
      Id of the source
      """
      source: ID!

      """
      Time the pagination started to ignore new items
      """
      now: DateTime!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Ranking criteria for the feed
      """
      ranking: Ranking = POPULARITY
    ): PostConnection!

    """
    Get a single tag feed
    """
    tagFeed(
      """
      The tag to fetch
      """
      tag: String!

      """
      Time the pagination started to ignore new items
      """
      now: DateTime!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Ranking criteria for the feed
      """
      ranking: Ranking = POPULARITY
    ): PostConnection!

    """
    Get the user's default feed settings
    """
    feedSettings: FeedSettings! @auth

    """
    Get suggestions for search post query
    """
    searchPostSuggestions(
      """
      The query to search for
      """
      query: String!
    ): SearchPostSuggestionsResults!

    """
    Get a posts feed of a search query
    """
    searchPosts(
      """
      The query to search for
      """
      query: String!

      """
      Time the pagination started to ignore new items
      """
      now: DateTime!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): PostConnection!
  }

  extend type Mutation {
    """
    Add new filters to the user's feed
    """
    addFiltersToFeed(
      """
      The filters to add to the feed
      """
      filters: FiltersInput!
    ): FeedSettings @auth

    """
    Remove filters from the user's feed
    """
    removeFiltersFromFeed(
      """
      The filters to remove from the feed
      """
      filters: FiltersInput!
    ): FeedSettings @auth
  }
`;

export interface GQLFeedSettings {
  id: string;
  userId: string;
  includeTags: string[];
  excludeSources: GQLSource[];
}

export type GQLFiltersInput = AnonymousFeedFilters;

interface GQLSearchPostSuggestion {
  title: string;
}

export interface GQLSearchPostSuggestionsResults {
  query: string;
  hits: GQLSearchPostSuggestion[];
}

interface AnonymousFeedArgs extends FeedArgs {
  filters?: GQLFiltersInput;
}

interface ConfiguredFeedArgs extends FeedArgs {
  unreadOnly: boolean;
}

interface SourceFeedArgs extends FeedArgs {
  source: string;
}

interface TagFeedArgs extends FeedArgs {
  tag: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    anonymousFeed: feedResolver(
      (ctx, { now, ranking, filters }: AnonymousFeedArgs, builder) =>
        anonymousFeedBuilder(ctx, { now, ranking }, filters, builder),
    ),
    feed: feedResolver(
      (ctx, { now, ranking, unreadOnly }: ConfiguredFeedArgs, builder) =>
        configuredFeedBuilder(
          ctx,
          {
            now,
            ranking,
          },
          ctx.userId,
          unreadOnly,
          builder,
        ),
    ),
    sourceFeed: feedResolver(
      (ctx, { now, ranking, source }: SourceFeedArgs, builder) =>
        sourceFeedBuilder(ctx, { now, ranking }, source, builder),
    ),
    tagFeed: feedResolver((ctx, { now, ranking, tag }: TagFeedArgs, builder) =>
      tagFeedBuilder(ctx, { now, ranking }, tag, builder),
    ),
    feedSettings: (source, args, ctx): Promise<Feed> =>
      ctx.getRepository(Feed).findOneOrFail({
        where: {
          id: ctx.userId,
          userId: ctx.userId,
        },
      }),
    searchPostSuggestions: async (
      source,
      { query }: { query: string },
      ctx,
    ): Promise<GQLSearchPostSuggestionsResults> => {
      const suggestions = await searchPosts(
        query,
        {
          hitsPerPage: 5,
          attributesToRetrieve: ['objectID', 'title'],
          attributesToHighlight: ['title'],
          highlightPreTag: '<strong>',
          highlightPostTag: '</strong>',
        },
        ctx.userId,
        ctx.req.ip,
      );
      return {
        query,
        hits: suggestions.map((s) => ({ title: s.highlight })),
      };
    },
    searchPosts: forwardPagination(searchPostFeedBuilder, 30),
  },
  Mutation: {
    addFiltersToFeed: async (
      source,
      { filters }: { filters: GQLFiltersInput },
      ctx,
    ): Promise<Feed> =>
      ctx.con.transaction(
        async (manager): Promise<Feed> => {
          const feedId = ctx.userId;
          const feed = await manager.getRepository(Feed).save({
            userId: ctx.userId,
            id: feedId,
          });
          if (filters?.excludeSources?.length) {
            await manager.getRepository(FeedSource).save(
              filters.excludeSources.map((s) => ({
                feedId,
                sourceId: s,
              })),
            );
          }
          if (filters?.includeTags?.length) {
            await manager.getRepository(FeedTag).save(
              filters.includeTags.map((s) => ({
                feedId,
                tag: s,
              })),
            );
          }
          return feed;
        },
      ),
    removeFiltersFromFeed: async (
      source,
      { filters }: { filters: GQLFiltersInput },
      ctx,
    ): Promise<Feed> =>
      ctx.con.transaction(
        async (manager): Promise<Feed> => {
          const feedId = ctx.userId;
          const feed = await ctx.getRepository(Feed).findOneOrFail(feedId);
          if (filters?.excludeSources?.length) {
            await manager.getRepository(FeedSource).delete({
              feedId,
              sourceId: In(filters.excludeSources),
            });
          }
          if (filters?.includeTags?.length) {
            await manager.getRepository(FeedTag).delete({
              feedId,
              tag: In(filters.includeTags),
            });
          }
          return feed;
        },
      ),
  },
  FeedSettings: {
    includeTags: async (source: Feed, args, ctx): Promise<string[]> => {
      const tags = await ctx.getRepository(FeedTag).find({
        select: ['tag'],
        where: { feedId: source.id },
        order: { tag: 'ASC' },
      });
      return tags.map((t) => t.tag);
    },
    excludeSources: async (source: Feed, args, ctx): Promise<GQLSource[]> => {
      const displays = await ctx.con
        .createQueryBuilder()
        .select('source.*')
        .from(FeedSource, 'feed')
        .leftJoin(
          (subBuilder) => selectSource(ctx.userId, subBuilder),
          'source',
          'source."sourceId" = feed."sourceId"',
        )
        .orderBy('source."sourceName"')
        .getRawMany();
      return displays.map((d) => nestChild(d, 'source')['source']);
    },
  },
});
