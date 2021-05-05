import { SelectQueryBuilder } from 'typeorm';
import { Connection, ConnectionArguments } from 'graphql-relay';
import { IFieldResolver } from 'apollo-server-fastify';
import {
  Bookmark,
  FeedTag,
  Post,
  searchPosts,
  View,
  FeedSource,
  SourceDisplay,
  HiddenPost,
  PostKeyword,
} from '../entity';
import { GQLPost } from '../schema/posts';
import { Context } from '../Context';
import { OffsetPage, Page, PageGenerator } from '../schema/common';
import graphorm from '../graphorm';

export const whereTags = (
  tags: string[],
  builder: SelectQueryBuilder<Post>,
  alias: string,
): string => {
  const query = builder
    .subQuery()
    .select('1')
    .from(PostKeyword, 'pk')
    .where(`pk.keyword IN (:...tags)`, { tags })
    .andWhere(`pk.postId = ${alias}.id`)
    .getQuery();
  return `EXISTS${query}`;
};

export const whereKeyword = (
  keyword: string,
  builder: SelectQueryBuilder<Post>,
  alias: string,
): string => {
  const query = builder
    .subQuery()
    .select('1')
    .from(PostKeyword, 'pk')
    .where(`pk.keyword = :keyword`, { keyword })
    .andWhere(`pk."postId" = ${alias}.id`)
    .getQuery();
  return `EXISTS${query}`;
};

export const whereTagsInFeed = (
  feedId: string,
  builder: SelectQueryBuilder<Post>,
  alias: string,
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
    .from(PostKeyword, 'pk')
    .where(`pk.keyword IN ${feedTag}`)
    .andWhere(`pk.postId = ${alias}.id`)
    .getQuery();

  return `(NOT EXISTS${feedTag} OR EXISTS${query})`;
};

export const whereSourcesInFeed = (
  feedId: string,
  builder: SelectQueryBuilder<Post>,
  alias: string,
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
  alias: string,
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
  alias: string,
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
  removeHiddenPosts = true,
  removeBannedPosts = true,
): SelectQueryBuilder<Post> => {
  const selectSource = graphorm.mappings.Post.fields.source
    .customQuery(ctx, 'sd', builder.subQuery())
    .from(SourceDisplay, 'sd')
    .andWhere(`sd."sourceId" = "${alias}"."sourceId"`);
  let newBuilder = builder.andWhere(`EXISTS${selectSource.getQuery()}`, {
    userId: ctx.userId,
  });
  if (ctx.userId && removeHiddenPosts) {
    newBuilder = newBuilder
      .leftJoin(
        HiddenPost,
        'hidden',
        `hidden.postId = "${alias}".id AND hidden.userId = :userId`,
        { userId: ctx.userId },
      )
      .andWhere('hidden.postId IS NULL');
  }
  if (removeBannedPosts) {
    newBuilder = newBuilder.andWhere(`"${alias}".banned = FALSE`);
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
  removeHiddenPosts = true,
  removeBannedPosts = true,
): IFieldResolver<TSource, Context, TArgs> {
  return async (source, args, context, info): Promise<Connection<GQLPost>> => {
    const page = pageGenerator.connArgsToPage(args);
    return graphorm.queryPaginated<GQLPost>(
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
          removeHiddenPosts,
          removeBannedPosts,
        );
        return builder;
      },
      (nodes) => pageGenerator.transformNodes?.(page, nodes) ?? nodes,
    );
  };
}

export function randomPostsResolver<
  TSource,
  TArgs extends { first?: number | null }
>(
  query: (
    ctx: Context,
    args: TArgs,
    builder: SelectQueryBuilder<Post>,
    alias: string,
  ) => SelectQueryBuilder<Post>,
  defaultPageSize: number,
): IFieldResolver<TSource, Context, TArgs> {
  return async (source, args, context, info): Promise<GQLPost[]> => {
    const pageSize = args.first ?? defaultPageSize;
    return graphorm.query(context, info, (builder) => {
      builder.queryBuilder = applyFeedWhere(
        context,
        query(context, args, builder.queryBuilder, builder.alias),
        builder.alias,
        true,
      )
        .orderBy('random()')
        .limit(pageSize);
      return builder;
    });
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
  alias: string,
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
  alias: string,
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
  alias: string,
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
      whereUnread(ctx.userId, subBuilder, alias),
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
  alias: string,
): SelectQueryBuilder<Post> =>
  builder.andWhere(`${alias}.sourceId = :sourceId`, {
    sourceId,
  });

export const tagFeedBuilder = (
  ctx: Context,
  tag: string,
  builder: SelectQueryBuilder<Post>,
  alias: string,
): SelectQueryBuilder<Post> =>
  builder.andWhere((subBuilder) => whereTags([tag], subBuilder, alias));

export const searchPostsForFeed = async (
  { query }: FeedArgs & { query: string },
  ctx: Context,
  { limit, offset }: OffsetPage,
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
