import {
  AdvancedSettings,
  BookmarkList,
  Feed,
  FeedAdvancedSettings,
  FeedSource,
  FeedTag,
  Post,
  Source,
} from '../entity';
import { Category } from '../entity/Category';
import { GraphQLResolveInfo } from 'graphql';

import { IFieldResolver, IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import {
  anonymousFeedBuilder,
  AnonymousFeedFilters,
  base64,
  configuredFeedBuilder,
  FeedArgs,
  feedResolver,
  feedToFilters,
  fixedIdsFeedBuilder,
  getCursorFromAfter,
  randomPostsResolver,
  Ranking,
  sourceFeedBuilder,
  tagFeedBuilder,
  whereKeyword,
} from '../common';
import { In, SelectQueryBuilder } from 'typeorm';
import { ensureSourcePermissions, GQLSource } from './sources';
import {
  fixedIdsPageGenerator,
  offsetPageGenerator,
  Page,
  PageGenerator,
  getSearchQuery,
} from './common';
import { GQLPost } from './posts';
import { Connection, ConnectionArguments } from 'graphql-relay';
import graphorm from '../graphorm';
import {
  generatePersonalizedFeed,
  getPersonalizedFeedKeyPrefix,
} from '../personalizedFeed';
import { ioRedisPool } from '../redis';

interface GQLTagsCategory {
  id: string;
  emoji: string;
  title: string;
  tags: string[];
}

export const typeDefs = /* GraphQL */ `
  type AdvancedSettings {
    id: Int!
    title: String!
    description: String!
    defaultEnabledState: Boolean!
  }

  type FeedAdvancedSettings {
    id: Int!
    enabled: Boolean!
  }

  type FeedSettings {
    id: String
    userId: String
    includeTags: [String]
    blockedTags: [String]
    excludeSources: [Source]
    advancedSettings: [FeedAdvancedSettings]
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

  type TagsCategory {
    id: String!
    emoji: String
    title: String!
    tags: [String]!
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

  input FeedAdvancedSettingsInput {
    """
    Advanced Settings ID
    """
    id: Int!

    """
    State if the sources related to advanced settings will be included/excluded
    """
    enabled: Boolean!
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

    """
    Posts must not include even one tag from this list
    """
    blockedTags: [String!]
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

      """
      Version of the feed algorithm
      """
      version: Int = 1

      """
      Array of supported post types
      """
      supportedTypes: [String!]
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

      """
      Version of the feed algorithm
      """
      version: Int = 1

      """
      Array of supported post types
      """
      supportedTypes: [String!]
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

      """
      Array of supported post types
      """
      supportedTypes: [String!]
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

      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection!

    """
    Get a single keyword feed
    """
    keywordFeed(
      """
      The keyword to fetch
      """
      keyword: String!

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
      Array of supported post types
      """
      supportedTypes: [String!]
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

      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection!

    """
    Returns the user's RSS feeds
    """
    rssFeeds: [RSSFeed!]! @auth

    """
    Get a single author feed
    """
    authorFeed(
      """
      Id of the author
      """
      author: ID!

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
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection!

    """
    Get the most upvoted articles in the past 7 days feed
    """
    mostUpvotedFeed(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Number of days since publication
      """
      period: Int

      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection!

    """
    Get the most discussed articles
    """
    mostDiscussedFeed(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection!

    """
    Get random trending posts
    """
    randomTrendingPosts(
      """
      Post ID to filter out
      """
      post: ID

      """
      Paginate first
      """
      first: Int
    ): [Post]!

    """
    Get random similar posts to a given post
    """
    randomSimilarPosts(
      """
      Post ID
      """
      post: ID!

      """
      Paginate first
      """
      first: Int
    ): [Post]!

    """
    Get random similar posts by tags
    """
    randomSimilarPostsByTags(
      """
      Array of tags
      """
      tags: [String]!

      """
      Post ID
      """
      post: ID

      """
      Paginate first
      """
      first: Int
    ): [Post]!

    """
    Get random best discussion posts
    """
    randomDiscussedPosts(
      """
      Post ID to filter out
      """
      post: ID

      """
      Paginate first
      """
      first: Int
    ): [Post]!

    """
    Get the categories of tags
    """
    tagsCategories: [TagsCategory]!

    """
    Get the list of advanced settings
    """
    advancedSettings: [AdvancedSettings]!
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

    """
    Update user's feed advanced settings
    """
    updateFeedAdvancedSettings(
      """
      Posts must comply with the advanced settings from this list
      """
      settings: [FeedAdvancedSettingsInput]!
    ): [FeedAdvancedSettings]! @auth
  }
`;

export interface GQLRSSFeed {
  name: string;
  url: string;
}

export interface GQLAdvancedSettings {
  id: number;
  title: string;
  description: string;
}

export interface GQLFeedAdvancedSettings {
  id: number;
  enabled: boolean;
}

export interface GQLFeedAdvancedSettingsInput {
  id: number;
  enabled: boolean;
}

export interface GQLFeedSettings {
  id: string;
  userId: string;
  includeTags: string[];
  blockedTags: string[];
  excludeSources: GQLSource[];
  advancedSettings: GQLFeedAdvancedSettings[];
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
  version: number;
}

interface ConfiguredFeedArgs extends FeedArgs {
  unreadOnly: boolean;
  version: number;
}

interface SourceFeedArgs extends FeedArgs {
  source: string;
}

interface TagFeedArgs extends FeedArgs {
  tag: string;
}

interface KeywordFeedArgs extends FeedArgs {
  keyword: string;
}

interface AuthorFeedArgs extends FeedArgs {
  author: string;
}

interface FeedPage extends Page {
  timestamp?: Date;
  score?: number;
}

const feedPageGenerator: PageGenerator<GQLPost, FeedArgs, FeedPage, unknown> = {
  connArgsToPage: ({ ranking, first, after }: FeedArgs) => {
    const cursor = getCursorFromAfter(after);
    // Increment by one to determine if there's one more page
    const limit = Math.min(first || 30, 50) + 1;
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
    return base64(`time:${new Date(node.createdAt).getTime()}`);
  },
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!(page.score || page.timestamp),
  transformNodes: (page, nodes) => nodes.slice(0, page.limit - 1),
};

const applyFeedPaging = (
  ctx: Context,
  { ranking }: FeedArgs,
  page: FeedPage,
  builder: SelectQueryBuilder<Post>,
  alias,
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
    blockedTags: [],
    advancedSettings: [],
  };
};

const searchResolver = feedResolver(
  (ctx, { query }: FeedArgs & { query: string }, builder, alias) =>
    builder
      .andWhere(`${alias}.tsv @@ (${getSearchQuery(':query')})`, {
        query,
      })
      .orderBy('views', 'DESC'),
  offsetPageGenerator(30, 50),
  (ctx, args, page, builder) => builder.limit(page.limit).offset(page.offset),
  {
    removeHiddenPosts: true,
    removeBannedPosts: false,
    allowPrivateSources: false,
  },
);

const anonymousFeedResolverV1: IFieldResolver<
  unknown,
  Context,
  AnonymousFeedArgs
> = feedResolver(
  (ctx, { filters }: AnonymousFeedArgs, builder, alias) =>
    anonymousFeedBuilder(ctx, filters, builder, alias),
  feedPageGenerator,
  applyFeedPaging,
);

const feedResolverV1: IFieldResolver<unknown, Context, ConfiguredFeedArgs> =
  feedResolver(
    (ctx, { unreadOnly }: ConfiguredFeedArgs, builder, alias, queryParams) =>
      configuredFeedBuilder(
        ctx,
        ctx.userId,
        unreadOnly,
        builder,
        alias,
        queryParams,
      ),
    feedPageGenerator,
    applyFeedPaging,
    {
      fetchQueryParams: async (ctx) =>
        feedToFilters(ctx.con, ctx.userId, ctx.userId),
    },
  );

const invalidateFeedCache = async (feedId: string): Promise<void> => {
  try {
    const key = getPersonalizedFeedKeyPrefix(feedId);
    await ioRedisPool.execute(async (client) => {
      return client.set(
        `${key}:update`,
        new Date().toISOString(),
        'EX',
        24 * 60 * 60,
      );
    });
  } catch (err) {
    console.error(err);
  }
};

const feedResolverV2: IFieldResolver<
  unknown,
  Context,
  FeedArgs & { version: number; feedId?: string }
> = feedResolver(
  (ctx, args, builder, alias, queryParams) =>
    fixedIdsFeedBuilder(
      ctx,
      queryParams.map(([postId]) => postId as string),
      builder,
      alias,
    ),
  fixedIdsPageGenerator(30, 50),
  (ctx, args, page, builder) => builder,
  {
    fetchQueryParams: (
      ctx,
      args: FeedArgs & { version: number; feedId?: string },
      page,
    ) =>
      generatePersonalizedFeed({
        con: ctx.con,
        pageSize: page.limit,
        offset: page.offset,
        feedVersion: args.version,
        userId: ctx.userId || ctx.trackingId,
        feedId: args.feedId,
        ctx,
      }),
    warnOnPartialFirstPage: true,
  },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    anonymousFeed: (source, args: AnonymousFeedArgs, ctx: Context, info) => {
      if (args.version >= 2 && args.ranking === Ranking.POPULARITY) {
        return feedResolverV2(source, args, ctx, info);
      }
      return anonymousFeedResolverV1(source, args, ctx, info);
    },
    feed: (source, args: ConfiguredFeedArgs, ctx: Context, info) => {
      if (args.version >= 2 && args.ranking === Ranking.POPULARITY) {
        return feedResolverV2(
          source,
          { ...args, feedId: ctx.userId },
          ctx,
          info,
        );
      }
      return feedResolverV1(source, args, ctx, info);
    },
    sourceFeed: feedResolver(
      (ctx, { source }: SourceFeedArgs, builder, alias) =>
        sourceFeedBuilder(ctx, source, builder, alias),
      feedPageGenerator,
      applyFeedPaging,
      {
        removeHiddenPosts: true,
        removeBannedPosts: false,
        fetchQueryParams: async (
          ctx,
          { source: sourceId }: SourceFeedArgs,
        ): Promise<void> => {
          await ensureSourcePermissions(ctx, sourceId);
        },
      },
    ),
    tagFeed: feedResolver(
      (ctx, { tag }: TagFeedArgs, builder, alias) =>
        tagFeedBuilder(ctx, tag, builder, alias),
      feedPageGenerator,
      applyFeedPaging,
      { allowPrivateSources: false },
    ),
    keywordFeed: feedResolver(
      (ctx, { keyword }: KeywordFeedArgs, builder, alias) =>
        builder.andWhere((subBuilder) =>
          whereKeyword(keyword, subBuilder, alias),
        ),
      feedPageGenerator,
      applyFeedPaging,
      { allowPrivateSources: false },
    ),
    feedSettings: (source, args, ctx, info): Promise<GQLFeedSettings> =>
      getFeedSettings(ctx, info),
    searchPostSuggestions: async (
      source,
      { query }: { query: string },
      ctx,
    ): Promise<GQLSearchPostSuggestionsResults> => {
      const hits: { title: string }[] = await ctx.con.query(
        `
          WITH search AS (${getSearchQuery('$1')})
          select ts_headline(process_text(title), search.query,
                             'StartSel = <strong>, StopSel = </strong>') as title
          from post
                 inner join search on true
                 inner join source on source.id = post."sourceId"
          where tsv @@ search.query and source.private = false
          order by views desc
            limit 5;
        `,
        [query],
      );
      return {
        query,
        hits,
      };
    },
    searchPosts: async (
      source,
      args: FeedArgs & { query: string },
      ctx,
      info,
    ): Promise<Connection<GQLPost> & { query: string }> => {
      const res = await searchResolver(source, args, ctx, info);
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
    authorFeed: feedResolver(
      (ctx, { author }: AuthorFeedArgs, builder, alias) =>
        builder
          .addSelect(
            `CASE WHEN ${alias}."scoutId" = '${author}' THEN 1 ELSE 0 END`,
            'isScout',
          )
          .addSelect(
            `CASE WHEN ${alias}."authorId" = '${author}' THEN 1 ELSE 0 END`,
            'isAuthor',
          )
          .andWhere(
            `(${alias}."authorId" = :author or ${alias}."scoutId" = :author)`,
            { author },
          ),
      feedPageGenerator,
      applyFeedPaging,
      {
        removeHiddenPosts: false,
        removeBannedPosts: false,
        allowPrivateSources: false,
      },
    ),
    mostUpvotedFeed: feedResolver(
      (
        ctx,
        { period }: ConnectionArguments & { period?: number },
        builder,
        alias,
      ) => {
        const interval = [7, 30, 365].find((num) => num === period) ?? 7;
        return builder
          .andWhere(
            `${alias}."createdAt" > now() - interval '${interval} days'`,
          )
          .andWhere(`${alias}."upvotes" >= 10`)
          .orderBy(`${alias}."upvotes"`, 'DESC');
      },
      offsetPageGenerator(30, 50, 100),
      (ctx, args, { limit, offset }, builder) =>
        builder.limit(limit).offset(offset),
      { removeHiddenPosts: true, removeBannedPosts: false },
    ),
    mostDiscussedFeed: feedResolver(
      (ctx, args, builder, alias) =>
        builder
          .andWhere(`${alias}."createdAt" > now() - interval '30 days'`)
          .andWhere(`${alias}."comments" >= 1`)
          .orderBy(`${alias}."comments"`, 'DESC'),
      offsetPageGenerator(30, 50, 100),
      (ctx, args, { limit, offset }, builder) =>
        builder.limit(limit).offset(offset),
      { removeHiddenPosts: true, allowPrivateSources: false },
    ),
    randomTrendingPosts: randomPostsResolver(
      (
        ctx,
        { post }: { post: string | null; first: number | null },
        builder,
        alias,
      ) => {
        let newBuilder = builder.andWhere(`${alias}."trending" > 0`);
        if (post) {
          newBuilder = newBuilder.andWhere(`${alias}."id" != :postId`, {
            postId: post,
          });
        }
        return newBuilder;
      },
      3,
    ),
    randomSimilarPosts: randomPostsResolver(
      (
        ctx,
        { post }: { post: string; first: number | null },
        builder,
        alias,
      ) => {
        const similarPostsQuery = `select post.id
                                   from active_post as post
                                          inner join (select count(*)           as similar,
                                                             min(k.occurrences) as occurrences,
                                                             pk."postId"
                                                      from post_keyword pk
                                                             inner join post_keyword pk2 on pk.keyword = pk2.keyword
                                                             inner join keyword k on pk.keyword = k.value
                                                      where pk2."postId" = :postId
                                                        and k.status = 'allow'
                                                      group by pk."postId") k
                                                     on k."postId" = post.id
                                   where post.id != :postId
                                     and post."createdAt" >= now() - interval '6 month'
                                     and post."upvotes" > 0
                                   order by (pow(post.upvotes, k.similar) *
                                     1000 / k.occurrences) desc
                                     limit 25`;
        return builder.andWhere(`${alias}."id" in (${similarPostsQuery})`, {
          postId: post,
        });
      },
      3,
    ),
    randomSimilarPostsByTags: randomPostsResolver(
      (
        ctx,
        {
          tags,
          post,
        }: { tags: string[]; post: string | null; first: number | null },
        builder,
        alias,
      ) => {
        let similarPostsQuery;
        if (tags?.length > 0) {
          similarPostsQuery = `select post.id
                               from active_post as post
                                      inner join (select count(*)           as similar,
                                                         min(k.occurrences) as occurrences,
                                                         pk."postId"
                                                  from post_keyword pk
                                                         inner join keyword k on pk.keyword = k.value
                                                  where k.value in (:...tags)
                                                    and k.status = 'allow'
                                                  group by pk."postId") k
                                                 on k."postId" = post.id
                               where post.id != :postId
                                 and post."createdAt" >= now() - interval '6 month'
                               order by (pow(post.upvotes, k.similar) * 1000 /
                                 k.occurrences) desc
                                 limit 25`;
        } else {
          similarPostsQuery = `select post.id
                               from post
                               where post.id != :postId
                                 and post."createdAt" >= now() - interval '6 month'
                               order by post.upvotes desc
                                 limit 25`;
        }
        return builder.andWhere(`${alias}."id" in (${similarPostsQuery})`, {
          postId: post,
          tags,
        });
      },
      3,
    ),
    randomDiscussedPosts: randomPostsResolver(
      (
        ctx,
        { post }: { post: string | null; first: number | null },
        builder,
        alias,
      ) => {
        let newBuilder = builder
          .andWhere(`${alias}."discussionScore" > 0`)
          .andWhere(`${alias}."comments" >= 4`);
        if (post) {
          newBuilder = newBuilder.andWhere(`${alias}."id" != :postId`, {
            postId: post,
          });
        }
        return newBuilder;
      },
      3,
    ),
    tagsCategories: (_, __, ctx): Promise<GQLTagsCategory[]> =>
      ctx.getRepository(Category).find({ order: { title: 'ASC' } }),
    advancedSettings: async (_, __, ctx): Promise<GQLAdvancedSettings[]> => {
      return ctx
        .getRepository(AdvancedSettings)
        .find({ order: { title: 'ASC' } });
    },
  },
  Mutation: {
    addFiltersToFeed: async (
      _,
      { filters }: { filters: GQLFiltersInput },
      ctx,
      info,
    ): Promise<GQLFeedSettings> => {
      const feedId = ctx.userId;
      await ctx.con.transaction(async (manager): Promise<void> => {
        await manager.getRepository(Feed).save({
          userId: ctx.userId,
          id: feedId,
        });
        if (filters?.excludeSources?.length) {
          const [query, params] = ctx.con
            .createQueryBuilder()
            .select('id', 'sourceId')
            .addSelect(`'${feedId}'`, 'feedId')
            .from(Source, 'source')
            .where('source.id IN (:...ids)', { ids: filters.excludeSources })
            .getQueryAndParameters();
          await manager.query(
            `insert into feed_source("sourceId", "feedId") ${query} on conflict
            do nothing`,
            params,
          );
        }
        if (filters?.includeTags?.length) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(FeedTag)
            .values(
              filters.includeTags.map((s) => ({
                feedId,
                tag: s,
              })),
            )
            .onConflict(`("feedId", "tag") DO UPDATE SET blocked = false`)
            .execute();
        }
        if (filters?.blockedTags?.length) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(FeedTag)
            .values(
              filters.blockedTags.map((s) => ({
                feedId,
                tag: s,
                blocked: true,
              })),
            )
            .onConflict(`("feedId", "tag") DO UPDATE SET blocked = true`)
            .execute();
        }
      });
      await invalidateFeedCache(feedId);
      return getFeedSettings(ctx, info);
    },
    removeFiltersFromFeed: async (
      source,
      { filters }: { filters: GQLFiltersInput },
      ctx,
      info,
    ): Promise<GQLFeedSettings> => {
      const feedId = ctx.userId;
      await ctx.con.transaction(async (manager): Promise<void> => {
        await ctx.getRepository(Feed).findOneByOrFail({ id: feedId });
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
        if (filters?.blockedTags?.length) {
          await manager.getRepository(FeedTag).delete({
            feedId,
            tag: In(filters.blockedTags),
          });
        }
      });
      await invalidateFeedCache(feedId);
      return getFeedSettings(ctx, info);
    },
    updateFeedAdvancedSettings: async (
      _,
      { settings }: { settings: GQLFeedAdvancedSettingsInput[] },
      ctx,
    ): Promise<GQLFeedAdvancedSettings[]> => {
      const feedId = ctx.userId;
      const feedRepo = ctx.con.getRepository(Feed);
      const feed = await feedRepo.findOneBy({ id: feedId });
      const feedAdvSettingsrepo = ctx.con.getRepository(FeedAdvancedSettings);

      if (!feed) {
        await feedRepo.save({ userId: feedId, id: feedId });
      }

      await feedAdvSettingsrepo
        .createQueryBuilder()
        .insert()
        .into(FeedAdvancedSettings)
        .values(
          settings.map(({ id, enabled }) => ({
            feedId,
            advancedSettingsId: id,
            enabled: enabled,
          })),
        )
        .onConflict(
          '("advancedSettingsId", "feedId") DO UPDATE SET enabled = excluded.enabled',
        )
        .execute();

      await invalidateFeedCache(feedId);

      return feedAdvSettingsrepo
        .createQueryBuilder()
        .select('"advancedSettingsId" AS id, enabled')
        .where({ feedId })
        .execute();
    },
  },
});
