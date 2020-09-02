import { SelectQueryBuilder } from 'typeorm';
import { lowerFirst } from 'lodash';
import { Connection, ConnectionArguments } from 'graphql-relay';
import { IFieldResolver } from 'apollo-server-fastify';
import {
  Bookmark,
  FeedTag,
  Post,
  PostTag,
  searchPosts,
  View,
  FeedSource,
  SourceDisplay,
  HiddenPost,
} from '../entity';
import { GQLPost } from '../schema/posts';
import { Context } from '../Context';
import { Page, PageGenerator } from '../schema/common';
import graphorm from '../graphorm';

export const nestChild = (obj: object, prefix: string): object => {
  obj[prefix] = Object.keys(obj).reduce((acc, key) => {
    if (key.startsWith(prefix)) {
      const value = obj[key];
      delete obj[key];
      return { [lowerFirst(key.substr(prefix.length))]: value, ...acc };
    }
    return acc;
  }, {});
  return obj;
};

export const selectSource = (
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builder: SelectQueryBuilder<any>,
): SelectQueryBuilder<SourceDisplay> => {
  let newBuilder = builder
    .distinctOn(['sd.sourceId'])
    .addSelect('sd.sourceId', 'sourceId')
    .addSelect('sd.name', 'sourceName')
    .addSelect('sd.image', 'sourceImage')
    .addSelect('sd.userId IS NULL', 'sourcePublic')
    .from(SourceDisplay, 'sd')
    .orderBy('sd.sourceId')
    .addOrderBy('sd.userId', 'ASC', 'NULLS LAST')
    .where('sd.userId IS NULL');
  if (userId) {
    newBuilder = newBuilder.orWhere('sd.userId = :userId', {
      userId,
    });
  }
  return newBuilder;
};

export const whereTags = (
  tags: string[],
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): string => {
  const query = builder
    .subQuery()
    .select('1')
    .from(PostTag, 't')
    .where(`t.tag IN (:...tags)`, { tags })
    .andWhere(`t.postId = ${alias}.id`)
    .getQuery();
  return `EXISTS${query}`;
};

export const whereTagsInFeed = (
  feedId: string,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): string => {
  const feedTag = builder
    .subQuery()
    .select('feed.tag')
    .from(FeedTag, 'feed')
    .where('feed.feedId = :feedId', { feedId })
    .getQuery();

  const query = builder
    .subQuery()
    .select('1')
    .from(PostTag, 't')
    .where(`t.tag IN ${feedTag}`)
    .andWhere(`t.postId = ${alias}.id`)
    .getQuery();

  return `(NOT EXISTS${feedTag} OR EXISTS${query})`;
};

export const whereSourcesInFeed = (
  feedId: string,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): string => {
  const query = builder
    .subQuery()
    .select('feed.sourceId')
    .from(FeedSource, 'feed')
    .where('feed.feedId = :feedId', { feedId })
    .getQuery();
  return `${alias}.sourceId NOT IN${query}`;
};

export const selectRead = (
  userId: string,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): string => {
  const query = builder
    .select('1')
    .from(View, 'view')
    .where(`view.userId = :userId`, { userId })
    .andWhere(`view.postId = ${alias}.id`)
    .getQuery();
  return `EXISTS${query}`;
};

export const whereUnread = (
  userId: string,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): string => `NOT ${selectRead(userId, builder.subQuery(), alias)}`;

export enum Ranking {
  POPULARITY = 'POPULARITY',
  TIME = 'TIME',
}

export interface FeedOptions {
  ranking: Ranking;
}

export type FeedArgs = ConnectionArguments & FeedOptions;

export const applyFeedWhere = (
  ctx: Context,
  builder: SelectQueryBuilder<Post>,
  alias: string,
): SelectQueryBuilder<Post> => {
  const whereSource = ctx.userId ? 'sd."userId" = :userId OR ' : '';
  let newBuilder = builder
    .innerJoin(SourceDisplay, 'sd', `${alias}."sourceId" = sd."sourceId"`)
    .andWhere(`(${whereSource}sd."userId" IS NULL)`, {
      userId: ctx.userId,
    });
  if (ctx.userId) {
    newBuilder = newBuilder
      .leftJoin(
        HiddenPost,
        'hidden',
        `hidden.postId = "${alias}".id AND hidden.userId = :userId`,
        { userId: ctx.userId },
      )
      .andWhere('hidden.postId IS NULL');
  }
  return newBuilder;
};

export function feedResolver<
  TSource,
  TArgs extends ConnectionArguments,
  TPage extends Page
>(
  query: (
    ctx: Context,
    args: TArgs,
    builder: SelectQueryBuilder<Post>,
    alias: string,
  ) => SelectQueryBuilder<Post>,
  pageGenerator: PageGenerator<GQLPost, TArgs, TPage>,
  applyPaging: (
    ctx: Context,
    args: TArgs,
    page: TPage,
    builder: SelectQueryBuilder<Post>,
    alias: string,
  ) => SelectQueryBuilder<Post>,
): IFieldResolver<TSource, Context, TArgs> {
  return async (source, args, context, info): Promise<Connection<GQLPost>> => {
    const page = pageGenerator.connArgsToPage(args);
    return graphorm.queryPaginated(
      context,
      info,
      (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
      (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
      (node, index) => pageGenerator.nodeToCursor(page, args, node, index),
      (builder) => {
        builder.queryBuilder = applyFeedWhere(
          context,
          applyPaging(
            context,
            args,
            page,
            query(context, args, builder.queryBuilder, builder.alias),
            builder.alias,
          ),
          builder.alias,
        );
        return builder;
      },
    );
  };
}

/**
 * Feeds builders and resolvers
 */

export interface AnonymousFeedFilters {
  includeSources?: string[];
  excludeSources?: string[];
  includeTags?: string[];
}

export const anonymousFeedBuilder = (
  ctx: Context,
  filters: AnonymousFeedFilters,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): SelectQueryBuilder<Post> => {
  let newBuilder = builder;
  if (filters?.includeSources?.length) {
    newBuilder = newBuilder.andWhere(`${alias}."sourceId" IN (:...sources)`, {
      sources: filters.includeSources,
    });
  } else if (filters?.excludeSources?.length) {
    newBuilder = newBuilder.andWhere(
      `${alias}."sourceId" NOT IN (:...sources)`,
      {
        sources: filters.excludeSources,
      },
    );
  }
  if (filters?.includeTags?.length) {
    newBuilder = newBuilder.andWhere((builder) =>
      whereTags(filters.includeTags, builder, alias),
    );
  }
  return newBuilder;
};

export const configuredFeedBuilder = (
  ctx: Context,
  feedId: string,
  unreadOnly: boolean,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): SelectQueryBuilder<Post> => {
  let newBuilder = builder;
  newBuilder = newBuilder
    .andWhere((subBuilder) => whereSourcesInFeed(feedId, subBuilder, alias))
    .andWhere((subBuilder) => whereTagsInFeed(feedId, subBuilder, alias));
  if (unreadOnly) {
    newBuilder = newBuilder.andWhere((subBuilder) =>
      whereUnread(ctx.userId, subBuilder, alias),
    );
  }
  return newBuilder;
};

export const bookmarksFeedBuilder = (
  ctx: Context,
  unreadOnly: boolean,
  listId: string | null,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): SelectQueryBuilder<Post> => {
  let newBuilder = builder
    .addSelect('bookmark.createdAt', 'bookmarkedAt')
    .innerJoin(
      Bookmark,
      'bookmark',
      `bookmark."postId" = ${alias}.id AND bookmark."userId" = :userId`,
      { userId: ctx.userId },
    );
  if (unreadOnly) {
    newBuilder = newBuilder.andWhere((subBuilder) =>
      whereUnread(ctx.userId, subBuilder),
    );
  }
  if (listId && ctx.premium) {
    newBuilder = newBuilder.andWhere('bookmark.listId = :listId', { listId });
  }
  return newBuilder;
};

export const sourceFeedBuilder = (
  ctx: Context,
  sourceId: string,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): SelectQueryBuilder<Post> =>
  builder.andWhere(`${alias}.sourceId = :sourceId`, {
    sourceId,
  });

export const tagFeedBuilder = (
  ctx: Context,
  tag: string,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): SelectQueryBuilder<Post> =>
  builder.andWhere((subBuilder) => whereTags([tag], subBuilder, alias));

export const searchPostsForFeed = async (
  { query }: FeedArgs & { query: string },
  ctx,
  { limit, offset },
): Promise<string[]> => {
  const hits = await searchPosts(
    query,
    {
      offset,
      length: limit,
      attributesToRetrieve: ['objectID'],
    },
    ctx.userId,
    ctx.req.ip,
  );
  return hits.map((h) => h.id);
};
