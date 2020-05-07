import { SelectQueryBuilder } from 'typeorm';
import { lowerFirst } from 'lodash';
import {
  Bookmark,
  HiddenPost,
  Post,
  PostTag,
  SourceDisplay,
  TagCount,
  View,
} from '../entity';
import { GQLPost } from '../schema/posts';
import { Context } from '../Context';
import { forwardPagination, PaginationResponse } from '../schema/common';
import { ConnectionArguments } from 'graphql-relay';
import { IFieldResolver } from 'apollo-server-fastify';

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

export const selectTags = (
  builder: SelectQueryBuilder<Post>,
): SelectQueryBuilder<PostTag> =>
  builder
    .select(
      "array_to_string(array_agg(tag.tag order by tcount.count DESC NULLS LAST, tag.tag ASC), ',')",
      'tags',
    )
    .from(PostTag, 'tag')
    .leftJoin(TagCount, 'tcount', 'tag.tag = tcount.tag')
    .where('post.id = tag.postId')
    .groupBy('tag.postId');

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

export const selectBookmarked = (
  userId: string,
  builder: SelectQueryBuilder<Post>,
): string => {
  const query = builder
    .select('1')
    .from(Bookmark, 'bookmark')
    .where(`bookmark.userId = :userId`, { userId })
    .andWhere('bookmark.postId = post.id')
    .getQuery();
  return `EXISTS${query}`;
};

export const mapRawPost = (post: object): GQLPost => {
  post = nestChild(post, 'source');
  post['tags'] = post['tags'] ? post['tags'].split(',') : [];
  return post as GQLPost;
};

export const generateFeed = async (
  ctx: Context,
  limit: number,
  offset: number,
  query: (builder: SelectQueryBuilder<Post>) => SelectQueryBuilder<Post>,
): Promise<PaginationResponse<GQLPost>> => {
  let builder = query(
    ctx.con
      .createQueryBuilder()
      .select('post.*')
      .addSelect('source.*')
      .addSelect(selectTags)
      .from(Post, 'post')
      .leftJoin(
        (subBuilder) => selectSource(ctx.userId, subBuilder),
        'source',
        'source."sourceId" = post."sourceId"',
      )
      .limit(limit)
      .offset(offset),
  );
  if (ctx.userId) {
    builder = builder
      .addSelect(selectRead(ctx.userId, builder.subQuery()), 'read')
      .addSelect(selectBookmarked(ctx.userId, builder.subQuery()), 'bookmarked')
      .leftJoin(
        HiddenPost,
        'hidden',
        'hidden.postId = post.id AND hidden.userId = :userId',
        { userId: ctx.userId },
      )
      .andWhere('hidden.postId IS NULL');
  }
  const res = await builder.getRawMany();

  return {
    hasNextPage: res.length === limit,
    nodes: res.map(mapRawPost),
  };
};

export function feedResolver<TSource, TArgs extends ConnectionArguments>(
  query: (
    ctx: Context,
    args: TArgs,
    builder: SelectQueryBuilder<Post>,
  ) => SelectQueryBuilder<Post>,
): IFieldResolver<TSource, Context, TArgs> {
  return forwardPagination(
    async (
      source,
      args: TArgs,
      ctx,
      { limit, offset },
    ): Promise<PaginationResponse<GQLPost>> => {
      return generateFeed(ctx, limit, offset, (builder) =>
        query(ctx, args, builder),
      );
    },
    30,
  );
}
