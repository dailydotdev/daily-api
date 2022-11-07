import { IFlags } from 'flagsmith-nodejs';
import { fetchUserFeatures } from './users';
import { AdvancedSettings, FeedAdvancedSettings } from '../entity';
import { Connection as ORMConnection, SelectQueryBuilder } from 'typeorm';
import { Connection, ConnectionArguments } from 'graphql-relay';
import { IFieldResolver } from '@graphql-tools/utils';
import {
  Bookmark,
  FeedTag,
  Post,
  View,
  FeedSource,
  HiddenPost,
  PostKeyword,
  Source,
} from '../entity';
import { GQLPost } from '../schema/posts';
import { Context } from '../Context';
import { Page, PageGenerator, getSearchQuery } from '../schema/common';
import graphorm from '../graphorm';
import { mapArrayToOjbect } from './object';
import { CustomObject } from '.';
import { runInSpan } from '../trace';

export const whereTags = (
  tags: string[],
  builder: SelectQueryBuilder<Post>,
  alias: string,
  variableAlias = 'tags',
): string => {
  const query = builder
    .subQuery()
    .select('1')
    .from(PostKeyword, 'pk')
    .where(`pk.keyword IN (:...${variableAlias})`, { [variableAlias]: tags })
    .andWhere(`pk.postId = ${alias}.id`)
    .getQuery();
  return `EXISTS${query}`;
};

export const whereNotTags = (
  tags: string[],
  builder: SelectQueryBuilder<Post>,
  alias: string,
): string => {
  return `NOT ${whereTags(tags, builder, alias, 'blockedTags')}`;
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

export const getFeatureAdvancedSettings = (
  features: IFlags,
  settings: AdvancedSettings[],
): AdvancedSettings[] => {
  const feature = features?.advanced_settings_default_values;

  if (!feature?.enabled) {
    return settings;
  }

  if (!feature.value || typeof feature.value !== 'string') {
    return settings;
  }

  const values = JSON.parse(feature.value) as CustomObject<boolean>;

  return settings.map((adv) => {
    if (values[adv.id] === undefined) {
      return adv;
    }

    return { ...adv, defaultEnabledState: values[adv.id] };
  });
};

const getUserFeaturesSettings = (userId: string) => {
  if (!process.env.ENABLE_SETTINGS_EXPERIMENT) {
    return Promise.resolve({});
  }

  return fetchUserFeatures(userId);
};

export const getExcludedAdvancedSettings = async (
  con: ORMConnection,
  feedId: string,
  userId: string,
): Promise<number[]> => {
  const [features, advancedSettings, feedAdvancedSettings] = await Promise.all([
    getUserFeaturesSettings(userId),
    con.getRepository(AdvancedSettings).find(),
    con.getRepository(FeedAdvancedSettings).findBy({ feedId }),
  ]);
  const settings = getFeatureAdvancedSettings(features, advancedSettings);
  const userSettings = mapArrayToOjbect(
    feedAdvancedSettings,
    'advancedSettingsId',
    'enabled',
  );
  const excludedSettings = settings.filter((adv) => {
    if (userSettings[adv.id] !== undefined) {
      return userSettings[adv.id] === false;
    }

    return adv.defaultEnabledState === false;
  });

  return excludedSettings.map((adv) => adv.id);
};

export const feedToFilters = async (
  con: ORMConnection,
  feedId: string,
  userId: string,
): Promise<AnonymousFeedFilters> => {
  const settings = await getExcludedAdvancedSettings(con, feedId, userId);
  const [tags, excludeSources] = await Promise.all([
    con.getRepository(FeedTag).find({ where: { feedId } }),
    con
      .getRepository(Source)
      .createQueryBuilder('s')
      .select('s.id AS "id"')
      .where(`s.advancedSettings && ARRAY[:...settings]::integer[]`, {
        settings,
      })
      .orWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('fs."sourceId"')
          .from(FeedSource, 'fs')
          .where('fs."feedId" = :feedId', { feedId })
          .getQuery();

        return `s.id IN (${subQuery})`;
      })
      .execute(),
  ]);
  const tagFilters = tags.reduce(
    (acc, value) => {
      if (value.blocked) {
        acc.blockedTags.push(value.tag);
      } else {
        acc.includeTags.push(value.tag);
      }
      return acc;
    },
    { includeTags: [], blockedTags: [] },
  );
  return {
    ...tagFilters,
    excludeSources: excludeSources.map((sources: Source) => sources.id),
  };
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
    // .andWhere('feed.blocked = false')
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
  const selectSource = builder
    .subQuery()
    .from(Source, 'source')
    .where('source.private = false')
    .andWhere(`source.id = "${alias}"."sourceId"`)
    .andWhere(`${alias}.deleted = false`);
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

export type FeedResolverOptions<TArgs, TParams, TPage extends Page> = {
  removeHiddenPosts?: boolean;
  removeBannedPosts?: boolean;
  fetchQueryParams?: (
    ctx: Context,
    args: TArgs,
    page: TPage,
  ) => Promise<TParams>;
  warnOnPartialFirstPage?: boolean;
};

export function feedResolver<
  TSource,
  TArgs extends ConnectionArguments,
  TPage extends Page,
  TParams,
>(
  query: (
    ctx: Context,
    args: TArgs,
    builder: SelectQueryBuilder<Post>,
    alias: string,
    params?: TParams,
  ) => SelectQueryBuilder<Post>,
  pageGenerator: PageGenerator<GQLPost, TArgs, TPage, TParams>,
  applyPaging: (
    ctx: Context,
    args: TArgs,
    page: TPage,
    builder: SelectQueryBuilder<Post>,
    alias: string,
  ) => SelectQueryBuilder<Post>,
  {
    removeHiddenPosts = true,
    removeBannedPosts = true,
    fetchQueryParams,
    warnOnPartialFirstPage = false,
  }: FeedResolverOptions<TArgs, TParams, TPage> = {},
): IFieldResolver<TSource, Context, TArgs> {
  return async (source, args, context, info): Promise<Connection<GQLPost>> => {
    const page = pageGenerator.connArgsToPage(args);
    const queryParams =
      fetchQueryParams &&
      (await runInSpan(context.span, 'feedResolver.fetchQueryParams', () =>
        fetchQueryParams(context, args, page),
      ));
    const result = await runInSpan(
      context.span,
      'feedResolver.queryPaginated',
      () =>
        graphorm.queryPaginated<GQLPost>(
          context,
          info,
          (nodeSize) =>
            pageGenerator.hasPreviousPage(
              page,
              nodeSize,
              undefined,
              queryParams,
            ),
          (nodeSize) =>
            pageGenerator.hasNextPage(page, nodeSize, undefined, queryParams),
          (node, index) =>
            pageGenerator.nodeToCursor(page, args, node, index, queryParams),
          (builder) => {
            builder.queryBuilder = applyFeedWhere(
              context,
              applyPaging(
                context,
                args,
                page,
                query(
                  context,
                  args,
                  builder.queryBuilder,
                  builder.alias,
                  queryParams,
                ),
                builder.alias,
              ),
              builder.alias,
              removeHiddenPosts,
              removeBannedPosts,
            );
            return builder;
          },
          (nodes) =>
            pageGenerator.transformNodes?.(page, nodes, queryParams) ?? nodes,
        ),
    );
    // Sometimes the feed can have a bit less posts than requested due to recent ban or deletion
    if (
      warnOnPartialFirstPage &&
      !args.after &&
      result.edges.length < args.first * 0.5
    ) {
      context.log.warn(
        {
          args,
          userId: context.userId || context.trackingId,
          loggedIn: !!context.userId,
          posts: result.edges.length,
        },
        `feed's first page is missing posts`,
      );
    }
    return result;
  };
}

export function randomPostsResolver<
  TSource,
  TArgs extends { first?: number | null },
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
  blockedTags?: string[];
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
  if (filters?.blockedTags?.length) {
    newBuilder = newBuilder.andWhere((builder) =>
      whereNotTags(filters.blockedTags, builder, alias),
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
  filters: AnonymousFeedFilters,
): SelectQueryBuilder<Post> => {
  let newBuilder = anonymousFeedBuilder(ctx, filters, builder, alias);
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
  query?: string | null,
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
  if (query) {
    newBuilder = newBuilder.andWhere(
      `${alias}.tsv @@ (${getSearchQuery(':query')})`,
      {
        query,
      },
    );
  }
  return newBuilder;
};

export const sourceFeedBuilder = (
  ctx: Context,
  sourceId: string,
  builder: SelectQueryBuilder<Post>,
  alias: string,
): SelectQueryBuilder<Post> =>
  builder
    .andWhere(`${alias}.sourceId = :sourceId`, { sourceId })
    .andWhere(`${alias}.banned = false`);

export const tagFeedBuilder = (
  ctx: Context,
  tag: string,
  builder: SelectQueryBuilder<Post>,
  alias: string,
): SelectQueryBuilder<Post> =>
  builder.andWhere((subBuilder) => whereTags([tag], subBuilder, alias));

export const fixedIdsFeedBuilder = (
  ctx: Context,
  ids: string[],
  builder: SelectQueryBuilder<Post>,
  alias: string,
): SelectQueryBuilder<Post> => {
  // In case ids is empty make sure the query does not fail
  const idsStr = ids.length
    ? ids.map((id) => `'${id}'`).join(',')
    : `'nosuchid'`;
  return builder
    .andWhere(`${alias}.id IN (${idsStr})`)
    .orderBy(`array_position(array[${idsStr}], ${alias}.id)`);
};
