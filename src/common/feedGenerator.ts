import { SelectQueryBuilder } from 'typeorm';
import { lowerFirst } from 'lodash';
import { ConnectionArguments } from 'graphql-relay';
import { IFieldResolver } from 'apollo-server-fastify';
import {
  Bookmark,
  FeedTag,
  HiddenPost,
  Post,
  PostTag,
  searchPosts,
  SourceDisplay,
  View,
  BookmarkList,
  FeedSource,
} from '../entity';
import { GQLPost } from '../schema/posts';
import { Context } from '../Context';
import {
  forwardPagination,
  Page,
  PageGenerator,
  PaginationResponse,
} from '../schema/common';

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

export const whereTags = (
  tags: string[],
  builder: SelectQueryBuilder<Post>,
): string => {
  const query = builder
    .subQuery()
    .select('1')
    .from(PostTag, 't')
    .where(`t.tag IN (:...tags)`, { tags })
    .andWhere('t.postId = post.id')
    .getQuery();
  return `EXISTS${query}`;
};

export const whereTagsInFeed = (
  feedId: string,
  builder: SelectQueryBuilder<Post>,
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
    .andWhere('t.postId = post.id')
    .getQuery();

  return `(NOT EXISTS${feedTag} OR EXISTS${query})`;
};

export const whereSourcesInFeed = (
  feedId: string,
  builder: SelectQueryBuilder<Post>,
): string => {
  const query = builder
    .subQuery()
    .select('feed.sourceId')
    .from(FeedSource, 'feed')
    .where('feed.feedId = :feedId', { feedId })
    .getQuery();
  return `post.sourceId NOT IN${query}`;
};

export const selectRead = (
  userId: string,
  builder: SelectQueryBuilder<Post>,
): string => {
  const query = builder
    .select('1')
    .from(View, 'view')
    .where(`view.userId = :userId`, { userId })
    .andWhere('view.postId = post.id')
    .getQuery();
  return `EXISTS${query}`;
};

export const whereUnread = (
  userId: string,
  builder: SelectQueryBuilder<Post>,
): string => `NOT ${selectRead(userId, builder.subQuery())}`;

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

export const mapRawPost = (post: object): GQLPost => {
  post = nestChild(nestChild(post, 'source'), 'bookmarkList');
  if (!post['bookmarkList'].id) {
    delete post['bookmarkList'];
  }
  post['tags'] = post['tagsStr'] ? post['tagsStr'].split(',') : [];
  delete post['tagsStr'];
  return post as GQLPost;
};

export enum Ranking {
  POPULARITY = 'POPULARITY',
  TIME = 'TIME',
}

export interface FeedOptions {
  ranking: Ranking;
}

export type FeedArgs = ConnectionArguments & FeedOptions;

export const generateFeed = async <TPage extends Page>(
  ctx: Context,
  query: (builder: SelectQueryBuilder<Post>) => SelectQueryBuilder<Post>,
): Promise<PaginationResponse<GQLPost>> => {
  let builder = ctx.con
    .createQueryBuilder()
    .select('post.*')
    .addSelect('source.*')
    .from(Post, 'post')
    .innerJoin(
      (subBuilder) => selectSource(ctx.userId, subBuilder),
      'source',
      'source."sourceId" = post."sourceId"',
    );
  builder = query(builder);
  if (ctx.userId) {
    builder = builder
      .addSelect(selectRead(ctx.userId, builder.subQuery()), 'read')
      .addSelect('bookmark.postId IS NOT NULL', 'bookmarked')
      .leftJoin(
        Bookmark,
        'bookmark',
        'bookmark.postId = post.id AND bookmark.userId = :userId',
        { userId: ctx.userId },
      )
      .leftJoin(
        HiddenPost,
        'hidden',
        'hidden.postId = post.id AND hidden.userId = :userId',
        { userId: ctx.userId },
      )
      .andWhere('hidden.postId IS NULL');
    if (ctx.premium) {
      builder = builder
        .addSelect('bookmarkList.id', 'bookmarkListId')
        .addSelect('bookmarkList.name', 'bookmarkListName')
        .leftJoin(
          BookmarkList,
          'bookmarkList',
          'bookmarkList.id = bookmark.listId',
        );
    }
  }
  const res = await builder.getRawMany();

  return { nodes: res.map(mapRawPost) };
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
  ) => SelectQueryBuilder<Post>,
  pageGenerator: PageGenerator<GQLPost, TArgs, TPage>,
  applyPaging: (
    ctx: Context,
    args: TArgs,
    page: TPage,
    builder: SelectQueryBuilder<Post>,
  ) => SelectQueryBuilder<Post>,
): IFieldResolver<TSource, Context, TArgs> {
  return forwardPagination(
    async (
      source,
      args: TArgs,
      ctx,
      page,
    ): Promise<PaginationResponse<GQLPost>> =>
      generateFeed(ctx, (builder) =>
        applyPaging(ctx, args, page, query(ctx, args, builder)),
      ),
    pageGenerator,
  );
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
): SelectQueryBuilder<Post> => {
  let newBuilder = builder;
  if (filters?.includeSources?.length) {
    newBuilder = newBuilder.andWhere(`post.sourceId IN (:...sources)`, {
      sources: filters.includeSources,
    });
  } else if (filters?.excludeSources?.length) {
    newBuilder = newBuilder.andWhere(`post.sourceId NOT IN (:...sources)`, {
      sources: filters.excludeSources,
    });
  }
  if (filters?.includeTags?.length) {
    newBuilder = newBuilder.andWhere((builder) =>
      whereTags(filters.includeTags, builder),
    );
  }
  return newBuilder;
};

export const configuredFeedBuilder = (
  ctx: Context,
  feedId: string,
  unreadOnly: boolean,
  builder: SelectQueryBuilder<Post>,
): SelectQueryBuilder<Post> => {
  let newBuilder = builder;
  newBuilder = newBuilder
    .andWhere((subBuilder) => whereSourcesInFeed(feedId, subBuilder))
    .andWhere((subBuilder) => whereTagsInFeed(feedId, subBuilder));
  if (unreadOnly) {
    newBuilder = newBuilder.andWhere((subBuilder) =>
      whereUnread(ctx.userId, subBuilder),
    );
  }
  return newBuilder;
};

export const bookmarksFeedBuilder = (
  ctx: Context,
  unreadOnly: boolean,
  listId: string | null,
  builder: SelectQueryBuilder<Post>,
): SelectQueryBuilder<Post> => {
  let newBuilder = builder
    .addSelect('bookmark.createdAt', 'bookmarkedAt')
    .where('bookmark.postId IS NOT NULL');
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
): SelectQueryBuilder<Post> =>
  builder.andWhere(`post.sourceId = :sourceId`, {
    sourceId,
  });

export const tagFeedBuilder = (
  ctx: Context,
  tag: string,
  builder: SelectQueryBuilder<Post>,
): SelectQueryBuilder<Post> =>
  builder.andWhere((subBuilder) => whereTags([tag], subBuilder));

export const searchPostFeedBuilder = async (
  source,
  { query }: FeedArgs & { query: string },
  ctx,
  { limit, offset },
): Promise<PaginationResponse<GQLPost, { query: string }>> => {
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
  const postIds = hits.map((h) => h.id);
  const res = await generateFeed(ctx, (builder) =>
    builder.where('post.id IN (:...postIds)', { postIds }),
  );
  const sorted = res.nodes.sort(
    (a, b) => postIds.indexOf(a.id) - postIds.indexOf(b.id),
  );
  return {
    nodes: sorted,
    extra: { query },
  };
};
