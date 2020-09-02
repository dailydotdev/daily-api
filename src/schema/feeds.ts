import { GraphQLResolveInfo } from 'graphql';
import { gql, IResolvers } from 'apollo-server-fastify';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import {
  anonymousFeedBuilder,
  AnonymousFeedFilters,
  base64,
  configuredFeedBuilder,
  FeedArgs,
  feedResolver,
  getCursorFromAfter,
  Ranking,
  searchPostsForFeed,
  sourceFeedBuilder,
  tagFeedBuilder,
} from '../common';
import { In, SelectQueryBuilder } from 'typeorm';
import {
  BookmarkList,
  Feed,
  FeedSource,
  FeedTag,
  Post,
  searchPosts,
} from '../entity';
import { GQLSource } from './sources';
import { offsetPageGenerator, Page, PageGenerator } from './common';
import { GQLPost } from './posts';
import { Connection } from 'graphql-relay';
import graphorm from '../graphorm';

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

  type RSSFeed {
    name: String!
    url: String!
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
      now: DateTime

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
      now: DateTime

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
      now: DateTime

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
      now: DateTime

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
      now: DateTime

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): PostConnection!

    """
    Returns the user's RSS feeds
    """
    rssFeeds: [RSSFeed!]! @auth
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

export interface GQLRSSFeed {
  name: string;
  url: string;
}

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

interface FeedPage extends Page {
  timestamp?: Date;
  score?: number;
}

const feedPageGenerator: PageGenerator<GQLPost, FeedArgs, FeedPage> = {
  connArgsToPage: ({ ranking, first, after }: FeedArgs) => {
    const cursor = getCursorFromAfter(after);
    const limit = Math.min(first || 30, 50);
    if (cursor) {
      if (ranking === Ranking.POPULARITY) {
        return { limit, score: parseInt(cursor) };
      }
      return { limit, timestamp: new Date(parseInt(cursor)) };
    }
    return { limit };
  },
  nodeToCursor: (page, { ranking }, node) => {
    if (ranking === Ranking.POPULARITY) {
      return base64(`score:${node.score}`);
    }
    return base64(`time:${node.createdAt.getTime()}`);
  },
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!(page.score || page.timestamp),
};

const applyFeedPaging = (
  ctx: Context,
  { ranking }: FeedArgs,
  page: FeedPage,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): SelectQueryBuilder<Post> => {
  let newBuilder = builder
    .addSelect(
      ranking === Ranking.POPULARITY
        ? `${alias}.score as score`
        : `${alias}."createdAt" as "createdAt"`,
    )
    .limit(page.limit)
    .orderBy(
      ranking === Ranking.POPULARITY
        ? `${alias}.score`
        : `${alias}."createdAt"`,
      'DESC',
    );
  if (page.score) {
    newBuilder = newBuilder.andWhere(`${alias}.score < :score`, {
      score: page.score,
    });
  } else if (page.timestamp) {
    newBuilder = newBuilder.andWhere(`${alias}."createdAt" < :timestamp`, {
      timestamp: page.timestamp,
    });
  }
  return newBuilder;
};

const getFeedSettings = async (
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<GQLFeedSettings> => {
  const res = await graphorm.query<GQLFeedSettings>(ctx, info, (builder) => {
    builder.queryBuilder = builder.queryBuilder.andWhere(
      `"${builder.alias}".id = :userId AND "${builder.alias}"."userId" = :userId`,
      { userId: ctx.userId },
    );
    return builder;
  });
  if (res.length) {
    return res[0];
  }
  return {
    id: ctx.userId,
    userId: ctx.userId,
    excludeSources: [],
    includeTags: [],
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    anonymousFeed: feedResolver(
      (ctx, { filters }: AnonymousFeedArgs, builder, alias) =>
        anonymousFeedBuilder(ctx, filters, builder, alias),
      feedPageGenerator,
      applyFeedPaging,
    ),
    feed: feedResolver(
      (ctx, { unreadOnly }: ConfiguredFeedArgs, builder, alias) =>
        configuredFeedBuilder(ctx, ctx.userId, unreadOnly, builder, alias),
      feedPageGenerator,
      applyFeedPaging,
    ),
    sourceFeed: feedResolver(
      (ctx, { source }: SourceFeedArgs, builder, alias) =>
        sourceFeedBuilder(ctx, source, builder, alias),
      feedPageGenerator,
      applyFeedPaging,
    ),
    tagFeed: feedResolver(
      (ctx, { tag }: TagFeedArgs, builder, alias) =>
        tagFeedBuilder(ctx, tag, builder, alias),
      feedPageGenerator,
      applyFeedPaging,
    ),
    feedSettings: (source, args, ctx, info): Promise<GQLFeedSettings> =>
      getFeedSettings(ctx, info),
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
    searchPosts: async (
      source,
      args: FeedArgs & { query: string },
      ctx,
      info,
    ): Promise<Connection<GQLPost> & { query: string }> => {
      const pageGenerator = offsetPageGenerator(30, 50);
      const page = pageGenerator.connArgsToPage(args);
      const postIds = await searchPostsForFeed(args, ctx, page);
      const res = await graphorm.queryPaginated<GQLPost>(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) => pageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder = builder.queryBuilder.where(
            `${builder.alias}.id IN (:...postIds)`,
            { postIds },
          );
          return builder;
        },
        (nodes) =>
          nodes.sort((a, b) => postIds.indexOf(a.id) - postIds.indexOf(b.id)),
      );
      return {
        ...res,
        query: args.query,
      };
    },
    rssFeeds: async (source, args, ctx): Promise<GQLRSSFeed[]> => {
      const urlPrefix = `${process.env.URL_PREFIX}/rss`;
      const lists = await ctx.getRepository(BookmarkList).find({
        where: { userId: ctx.userId },
        select: ['id', 'name'],
        order: { name: 'ASC' },
      });
      return [
        { name: 'Recent news feed', url: `${urlPrefix}/f/${ctx.userId}` },
        { name: 'Bookmarks', url: `${urlPrefix}/b/${ctx.userId}` },
        ...lists.map((l) => ({
          name: l.name,
          url: `${urlPrefix}/b/l/${l.id.replace(/-/g, '')}`,
        })),
      ];
    },
  },
  Mutation: {
    addFiltersToFeed: async (
      source,
      { filters }: { filters: GQLFiltersInput },
      ctx,
      info,
    ): Promise<GQLFeedSettings> => {
      await ctx.con.transaction(
        async (manager): Promise<void> => {
          const feedId = ctx.userId;
          await manager.getRepository(Feed).save({
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
        },
      );
      return getFeedSettings(ctx, info);
    },
    removeFiltersFromFeed: async (
      source,
      { filters }: { filters: GQLFiltersInput },
      ctx,
      info,
    ): Promise<GQLFeedSettings> => {
      await ctx.con.transaction(
        async (manager): Promise<void> => {
          const feedId = ctx.userId;
          await ctx.getRepository(Feed).findOneOrFail(feedId);
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
        },
      );
      return getFeedSettings(ctx, info);
    },
  },
});
