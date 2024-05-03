import {
  AdvancedSettings,
  BookmarkList,
  Feed,
  FeedAdvancedSettings,
  FeedSource,
  FeedTag,
  Post,
  Source,
  UserPost,
} from '../entity';
import { Category } from '../entity/Category';
import { GraphQLResolveInfo } from 'graphql';

import { IFieldResolver, IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import {
  anonymousFeedBuilder,
  AnonymousFeedFilters,
  applyFeedWhere,
  base64,
  configuredFeedBuilder,
  FeedArgs,
  feedResolver,
  feedToFilters,
  fixedIdsFeedBuilder,
  getArgsFromAfter,
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
  offsetPageGenerator,
  Page,
  PageGenerator,
  feedCursorPageGenerator,
} from './common';
import { GQLPost } from './posts';
import { ConnectionArguments } from 'graphql-relay';
import graphorm from '../graphorm';
import {
  feedClient,
  FeedConfigName,
  FeedGenerator,
  feedGenerators,
  SimpleFeedConfigGenerator,
  versionToFeedGenerator,
} from '../integrations/feed';
import { AuthenticationError } from 'apollo-server-errors';
import { opentelemetry } from '../telemetry/opentelemetry';
import { UserVote } from '../types';

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
    group: String!
  }

  type FeedAdvancedSettings {
    id: Int!
    enabled: Boolean!
    advancedSettings: AdvancedSettings
  }

  type FeedSettings {
    id: String
    userId: String
    includeTags: [String]
    blockedTags: [String]
    excludeSources: [Source]
    advancedSettings: [FeedAdvancedSettings]
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
      Force refresh the feed
      """
      refresh: Boolean = false

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
    Get feed preview
    """
    feedPreview(
      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection! @auth

    """
    Get an adhoc feed using a provided config
    """
    feedByConfig(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Stringified JSON as the feed config
      """
      config: String!
    ): PostConnection!

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
    Get a user's upvote feed
    """
    userUpvotedFeed(
      """
      Id of the user
      """
      userId: ID!

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

      """
      ID of the source you want to get most upvoted feed for
      """
      source: ID

      """
      Tag to filter by
      """
      tag: String
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

      """
      ID of the source you want to get most upvoted feed for
      """
      source: ID

      """
      Tag to filter by
      """
      tag: String
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
    Get similar posts to provided post feed
    """
    similarPostsFeed(
      """
      Post to search by
      """
      post_id: ID!

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
  group: string;
}

export interface GQLFeedAdvancedSettings {
  id: number;
  enabled: boolean;
  advancedSettings: GQLAdvancedSettings;
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

interface AnonymousFeedArgs extends FeedArgs {
  filters?: GQLFiltersInput;
  version: number;
}

interface ConfiguredFeedArgs extends FeedArgs {
  unreadOnly: boolean;
  version: number;
  refresh?: boolean;
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
  pinned?: Date;
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

interface UpvotedPage extends Page {
  timestamp?: Date;
}

const upvotedPageGenerator: PageGenerator<
  GQLPost,
  ConnectionArguments,
  UpvotedPage
> = {
  connArgsToPage: ({ first, after }: FeedArgs) => {
    const cursor = getCursorFromAfter(after);
    const limit = Math.min(first || 30, 50);
    if (cursor) {
      return { limit, timestamp: new Date(parseInt(cursor)) };
    }
    return { limit };
  },
  nodeToCursor: (page, args, node) => {
    return base64(`time:${node.votedAt.getTime()}`);
  },
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!page.timestamp,
};

const applyUpvotedPaging = (
  ctx: Context,
  args,
  page: UpvotedPage,
  builder: SelectQueryBuilder<Post>,
): SelectQueryBuilder<Post> => {
  let newBuilder = builder.limit(page.limit).orderBy('up.votedAt', 'DESC');
  if (page.timestamp) {
    newBuilder = newBuilder.andWhere('up."votedAt" < :timestamp', {
      timestamp: page.timestamp,
    });
  }
  return newBuilder;
};

const feedPageGeneratorWithPin: PageGenerator<
  GQLPost,
  FeedArgs,
  FeedPage,
  unknown
> = {
  connArgsToPage: ({ first, after }: FeedArgs) => {
    const limit = Math.min(first || 30, 50) + 1;
    const result: FeedPage = { limit };
    const { time, pinned } = getArgsFromAfter(after);

    if (time) {
      result.timestamp = new Date(parseInt(time));
    }

    if (pinned) {
      result.pinned = new Date(parseInt(pinned));
    }

    return result;
  },
  nodeToCursor: (_, __, node) => {
    const params = [`time:${new Date(node.createdAt).getTime()}`];
    if (node.pinnedAt) {
      params.push(`pinned:${new Date(node.pinnedAt).getTime()}`);
    }

    return base64(params.join(';'));
  },
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!page.timestamp,
  transformNodes: (page, nodes) => nodes.slice(0, page.limit - 1),
};

const applyFeedPagingWithPin = (
  ctx: Context,
  { limit, timestamp, pinned }: FeedPage,
  builder: SelectQueryBuilder<Post>,
  alias,
): SelectQueryBuilder<Post> => {
  const newBuilder = builder
    .limit(limit)
    .orderBy(`${alias}."pinnedAt"`, 'DESC', 'NULLS LAST')
    .addOrderBy(`${alias}."createdAt"`, 'DESC');

  if (pinned) {
    return newBuilder.andWhere(
      `(${alias}."pinnedAt" < :pinned OR ${alias}."pinnedAt" IS NULL)`,
      { pinned },
    );
  }

  if (timestamp) {
    return newBuilder
      .andWhere(`${alias}."createdAt" < :timestamp`, {
        timestamp,
      })
      .andWhere(`${alias}."pinnedAt" IS NULL`);
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

const feedResolverCursor: IFieldResolver<
  unknown,
  Context,
  FeedArgs & { generator: FeedGenerator }
> = feedResolver(
  (ctx, args, builder, alias, queryParams) =>
    fixedIdsFeedBuilder(
      ctx,
      queryParams.data.map(([postId]) => postId as string),
      builder,
      alias,
    ),
  feedCursorPageGenerator(30, 50),
  (ctx, args, page, builder) => builder,
  {
    fetchQueryParams: (
      ctx,
      args: FeedArgs & { generator: FeedGenerator },
      page,
    ) =>
      args.generator.generate(ctx, {
        user_id: ctx.userId || ctx.trackingId,
        page_size: page.limit,
        offset: 0,
        cursor: page.cursor,
        allowed_post_types: args.supportedTypes,
        ...(args?.refresh && { refresh: true }),
      }),
    warnOnPartialFirstPage: true,
  },
);

const legacySimilarPostsResolver = randomPostsResolver(
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
                               from post
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
                                 and post.visible = true and post.deleted = false
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
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    anonymousFeed: (source, args: AnonymousFeedArgs, ctx: Context, info) => {
      if (
        args.version >= 2 &&
        args.ranking === Ranking.POPULARITY &&
        ctx.userId
      ) {
        return feedResolverCursor(
          source,
          {
            ...(args as FeedArgs),
            generator: feedGenerators['popular'],
          },
          ctx,
          info,
        );
      }
      return anonymousFeedResolverV1(source, args, ctx, info);
    },
    feed: (source, args: ConfiguredFeedArgs, ctx: Context, info) => {
      if (args.version >= 2 && args.ranking === Ranking.POPULARITY) {
        if (args?.refresh) {
          const meter = opentelemetry.metrics.getMeter('api-bg');
          const counter = meter.createCounter('force_refresh');
          counter.add(1);
        }

        return feedResolverCursor(
          source,
          {
            ...(args as FeedArgs),
            generator: versionToFeedGenerator(args.version),
          },
          ctx,
          info,
        );
      }
      return feedResolverV1(source, args, ctx, info);
    },
    feedPreview: (
      source,
      args: Pick<ConfiguredFeedArgs, 'supportedTypes'>,
      ctx: Context,
      info,
    ) => {
      return feedResolverCursor(
        source,
        {
          ...(args as FeedArgs),
          first: 20,
          ranking: Ranking.POPULARITY,
          generator: feedGenerators.onboarding,
        },
        ctx,
        info,
      );
    },
    feedByConfig: (
      source,
      args: ConnectionArguments & { config: string },
      ctx: Context,
      info,
    ) => {
      if (process.env.ENABLE_PRIVATE_ROUTES !== 'true') {
        throw new AuthenticationError(
          'Access denied! You need to be authorized to perform this action!',
        );
      }
      const generator = new FeedGenerator(
        feedClient,
        new SimpleFeedConfigGenerator(JSON.parse(args.config)),
      );
      return feedResolverCursor(
        source,
        {
          ...(args as ConnectionArguments),
          ranking: Ranking.POPULARITY,
          generator,
        },
        ctx,
        info,
      );
    },
    sourceFeed: feedResolver(
      (ctx, { source }: SourceFeedArgs, builder, alias) =>
        sourceFeedBuilder(ctx, source, builder, alias),
      feedPageGeneratorWithPin,
      (ctx, args, page, builder, alias) =>
        applyFeedPagingWithPin(ctx, page, builder, alias),
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
    userUpvotedFeed: feedResolver(
      (ctx, { userId }: { userId: string } & FeedArgs, builder, alias) =>
        builder
          .addSelect('up.votedAt', 'votedAt')
          .innerJoin(
            UserPost,
            'up',
            `up."postId" = ${alias}.id AND up."userId" = :author AND vote = :vote`,
            { author: userId, vote: UserVote.Up },
          ),
      upvotedPageGenerator,
      applyUpvotedPaging,
      {
        removeHiddenPosts: false,
        removeBannedPosts: false,
        allowPrivateSources: false,
      },
    ),
    mostUpvotedFeed: feedResolver(
      (
        ctx,
        {
          period,
          source,
          tag,
        }: ConnectionArguments & {
          period?: number;
          source?: string;
          tag?: string;
        },
        builder,
        alias,
      ) => {
        const interval = [7, 30, 365].find((num) => num === period) ?? 7;
        builder
          .andWhere(
            `${alias}."createdAt" > now() - interval '${interval} days'`,
          )
          .andWhere(`${alias}."upvotes" >= 10`)
          .orderBy(`${alias}."upvotes"`, 'DESC')
          .addOrderBy(`${alias}."createdAt"`, 'DESC');
        if (tag) {
          builder.andWhere((subBuilder) =>
            whereKeyword(tag, subBuilder, alias),
          );
        }
        if (source) {
          builder.andWhere(`${alias}."sourceId" = :source`, { source });
        }
        return builder;
      },
      offsetPageGenerator(30, 50, 100),
      (ctx, args, { limit, offset }, builder) =>
        builder.limit(limit).offset(offset),
      {
        removeHiddenPosts: true,
        allowPrivateSources: false,
        allowSquadPosts: false,
      },
    ),
    mostDiscussedFeed: feedResolver(
      (
        ctx,
        {
          source,
          tag,
        }: ConnectionArguments & {
          source?: string;
          tag?: string;
        },
        builder,
        alias,
      ) => {
        builder
          .andWhere(`${alias}."createdAt" > now() - interval '30 days'`)
          .andWhere(`${alias}."comments" >= 1`)
          .orderBy(`${alias}."comments"`, 'DESC')
          .addOrderBy(`${alias}."createdAt"`, 'DESC');
        if (tag) {
          builder.andWhere((subBuilder) =>
            whereKeyword(tag, subBuilder, alias),
          );
        }
        if (source) {
          builder.andWhere(`${alias}."sourceId" = :source`, { source });
        }
        return builder;
      },
      offsetPageGenerator(30, 50, 100),
      (ctx, args, { limit, offset }, builder) =>
        builder.limit(limit).offset(offset),
      {
        removeHiddenPosts: true,
        allowPrivateSources: false,
        allowSquadPosts: false,
      },
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
    similarPostsFeed: async (
      source,
      args: ConnectionArguments & {
        post_id: string;
      },
      ctx,
      info,
    ) => {
      const { post_id, ...restArgs } = args;
      const generator = new FeedGenerator(
        feedClient,
        new SimpleFeedConfigGenerator({
          feed_config_name: FeedConfigName.PostSimilarity,
          post_id,
        }),
      );
      return feedResolverCursor(
        source,
        {
          ...(restArgs as FeedArgs),
          generator,
        },
        ctx,
        info,
      );
    },
    randomSimilarPostsByTags: async (
      source,
      args: { tags: string[]; post: string | null; first: number | null },
      ctx,
      info,
    ): Promise<GQLPost[]> => {
      if (args.post) {
        const res = await feedGenerators['post_similarity'].generate(ctx, {
          user_id: ctx.userId,
          page_size: args.first || 3,
          post_id: args.post,
        });
        if (res?.data?.length) {
          return graphorm.query(ctx, info, (builder) => {
            builder.queryBuilder = applyFeedWhere(
              ctx,
              fixedIdsFeedBuilder(
                ctx,
                res.data.map(([postId]) => postId as string),
                builder.queryBuilder,
                builder.alias,
              ),
              builder.alias,
              ['article'],
              true,
              true,
              false,
            );
            return builder;
          });
        }
      }
      return legacySimilarPostsResolver(source, args, ctx, info);
    },
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

      return feedAdvSettingsrepo
        .createQueryBuilder()
        .select('"advancedSettingsId" AS id, enabled')
        .where({ feedId })
        .execute();
    },
  },
});
