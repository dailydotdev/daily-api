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
  nestChild,
  Ranking,
  searchPostFeedBuilder,
  selectSource,
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
import {
  forwardPagination,
  offsetPageGenerator,
  Page,
  PageGenerator,
} from './common';
import { GQLPost } from './posts';

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
  limit: number;
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
): SelectQueryBuilder<Post> => {
  let newBuilder = builder
    .limit(page.limit)
    .orderBy(
      ranking === Ranking.POPULARITY ? 'post.score' : 'post.createdAt',
      'DESC',
    );
  if (page.score) {
    newBuilder = newBuilder.andWhere('post.score < :score', {
      score: page.score,
    });
  } else if (page.timestamp) {
    newBuilder = newBuilder.andWhere('post."createdAt" < :timestamp', {
      timestamp: page.timestamp,
    });
  }
  return newBuilder;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    anonymousFeed: feedResolver(
      (ctx, { filters }: AnonymousFeedArgs, builder) =>
        anonymousFeedBuilder(ctx, filters, builder),
      feedPageGenerator,
      applyFeedPaging,
    ),
    feed: feedResolver(
      (ctx, { unreadOnly }: ConfiguredFeedArgs, builder) =>
        configuredFeedBuilder(ctx, ctx.userId, unreadOnly, builder),
      feedPageGenerator,
      applyFeedPaging,
    ),
    sourceFeed: feedResolver(
      (ctx, { source }: SourceFeedArgs, builder) =>
        sourceFeedBuilder(ctx, source, builder),
      feedPageGenerator,
      applyFeedPaging,
    ),
    tagFeed: feedResolver(
      (ctx, { tag }: TagFeedArgs, builder) => tagFeedBuilder(ctx, tag, builder),
      feedPageGenerator,
      applyFeedPaging,
    ),
    feedSettings: (source, args, ctx): Feed =>
      ctx.getRepository(Feed).create({
        id: ctx.userId,
        userId: ctx.userId,
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
    searchPosts: forwardPagination(
      searchPostFeedBuilder,
      offsetPageGenerator(30, 50),
    ),
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
        .innerJoin(
          (subBuilder) => selectSource(ctx.userId, subBuilder),
          'source',
          'source."sourceId" = feed."sourceId"',
        )
        .where('feed.feedId = :feedId', { feedId: source.id })
        .orderBy('source."sourceName"')
        .getRawMany();
      return displays.map((d) => nestChild(d, 'source')['source']);
    },
  },
});
