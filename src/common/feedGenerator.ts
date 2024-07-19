import {
  AdvancedSettings,
  FeedAdvancedSettings,
  SourceMember,
  UserPost,
} from '../entity';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Connection, ConnectionArguments } from 'graphql-relay';
import { IFieldResolver } from '@graphql-tools/utils';
import {
  Bookmark,
  FeedTag,
  Post,
  View,
  FeedSource,
  PostKeyword,
  Source,
} from '../entity';
import { GQLPost } from '../schema/posts';
import { Context } from '../Context';
import {
  Page,
  PageGenerator,
  getSearchQuery,
  processSearchQuery,
} from '../schema/common';
import graphorm from '../graphorm';
import { mapArrayToOjbect } from './object';
import { runInSpan } from '../telemetry';

export const WATERCOOLER_ID = 'fd062672-63b7-4a10-87bd-96dcd10e9613';

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

export const getExcludedAdvancedSettings = async (
  con: DataSource,
  feedId: string,
): Promise<Partial<AdvancedSettings>[]> => {
  const [settings, feedAdvancedSettings] = await Promise.all([
    con.getRepository(AdvancedSettings).find(),
    con.getRepository(FeedAdvancedSettings).findBy({ feedId }),
  ]);
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
  return excludedSettings.map(({ id, group, options }) => ({
    id,
    group,
    options,
  }));
};

export const feedToFilters = async (
  con: DataSource,
  feedId: string,
  userId: string,
): Promise<AnonymousFeedFilters> => {
  const settings = await getExcludedAdvancedSettings(con, feedId);
  const [tags, includeSources, excludeSources, memberships] = await Promise.all(
    [
      con.getRepository(FeedTag).find({ where: { feedId: feedId ?? '' } }),
      con
        .getRepository(Source)
        .createQueryBuilder('s')
        .select('s.id AS "id"')
        .where((qb) => {
          const subQuery = qb
            .subQuery()
            .select('fs."sourceId"')
            .from(FeedSource, 'fs')
            .where('fs."feedId" = :feedId', { feedId })
            .andWhere('fs.blocked = FALSE')
            .getQuery();

          return `s.id IN (${subQuery})`;
        })
        .execute(),
      con
        .getRepository(Source)
        .createQueryBuilder('s')
        .select('s.id AS "id"')
        .where((qb) => {
          const subQuery = qb
            .subQuery()
            .select('fs."sourceId"')
            .from(FeedSource, 'fs')
            .where('fs."feedId" = :feedId', { feedId })
            .andWhere('fs.blocked = TRUE')
            .getQuery();

          return `s.id IN (${subQuery})`;
        })
        .execute(),
      feedId
        ? con
            .getRepository(SourceMember)
            .createQueryBuilder('sm')
            .select('sm."sourceId"')
            .addSelect(
              "COALESCE((flags->'hideFeedPosts')::boolean, FALSE)",
              'hide',
            )
            .where('sm."userId" = :userId', { userId })
            .execute()
        : [],
    ],
  );
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

  const { excludeTypes, blockedContentCuration } = settings.reduce(
    (acc, curr) => {
      if (curr.options.type) {
        if (curr.group === 'content_types') {
          acc.excludeTypes.push(curr.options.type);
        }
        if (curr.group === 'content_curation') {
          acc.blockedContentCuration.push(curr.options.type);
        }
      }
      return acc;
    },
    { excludeTypes: [], blockedContentCuration: [] },
  );

  // Split memberships by hide flag
  const membershipsByHide = memberships.reduce(
    (acc, value: { sourceId: SourceMember['sourceId']; hide: boolean }) => {
      acc[value.hide ? 'hide' : 'show'].push(value.sourceId);
      return acc;
    },
    { hide: [], show: [] },
  );

  // If the user is not a member of the watercooler, hide it
  if (!membershipsByHide.show.includes(WATERCOOLER_ID)) {
    membershipsByHide.hide.push(WATERCOOLER_ID);
  }

  return {
    ...tagFilters,
    excludeTypes,
    includeSources: includeSources
      .map((sources: Source) => sources.id)
      .concat(membershipsByHide.hide),
    excludeSources: excludeSources
      .map((sources: Source) => sources.id)
      .concat(membershipsByHide.hide),
    sourceIds: membershipsByHide.show,
    blockedContentCuration,
  };
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
  supportedTypes?: string[];
  refresh?: boolean;
  feedId?: string;
}

export type FeedArgs = ConnectionArguments & FeedOptions;

export const applyFeedWhere = (
  ctx: Context,
  builder: SelectQueryBuilder<Post>,
  alias: string,
  postTypes: string[],
  removeHiddenPosts = true,
  removeBannedPosts = true,
  allowPrivateSources = true,
  allowSquadPosts = true,
): SelectQueryBuilder<Post> => {
  let newBuilder = builder.andWhere(`${alias}."type" in (:...postTypes)`, {
    postTypes,
  });
  if (!allowPrivateSources) {
    const selectSource = builder
      .subQuery()
      .from(Source, 'source')
      .where('source.private = false')
      .andWhere(`source.id = "${alias}"."sourceId"`);
    newBuilder = builder.andWhere(`EXISTS${selectSource.getQuery()}`);
  }

  if (!allowSquadPosts) {
    const selectSource = builder
      .subQuery()
      .from(Source, 'source')
      .where("source.type = 'squad'")
      .andWhere(`source.id = "${alias}"."sourceId"`);

    newBuilder = builder.andWhere(`NOT EXISTS${selectSource.getQuery()}`, {
      userId: ctx.userId,
    });
  }

  if (ctx.userId && removeHiddenPosts) {
    newBuilder = newBuilder
      .leftJoin(
        UserPost,
        'userpost',
        `userpost."postId" = "${alias}".id AND userpost."userId" = :userId AND userpost.hidden = TRUE`,
        { userId: ctx.userId },
      )
      .andWhere('userpost."postId" IS NULL');
  }
  if (removeBannedPosts) {
    newBuilder = newBuilder
      .andWhere(`"${alias}".banned = FALSE`)
      .andWhere(`"${alias}"."showOnFeed" = TRUE`);
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
  allowPrivateSources?: boolean;
  allowSquadPosts?: boolean;
};

export function feedResolver<
  TSource,
  TArgs extends Omit<FeedArgs, 'ranking'>,
  TPage extends Page,
  TParams,
>(
  query: (
    ctx: Context,
    args: TArgs,
    builder: SelectQueryBuilder<Post & { feedMeta?: string }>,
    alias: string,
    params?: TParams,
  ) => SelectQueryBuilder<Post & { feedMeta?: string }>,
  pageGenerator: PageGenerator<GQLPost, TArgs, TPage, TParams>,
  applyPaging: (
    ctx: Context,
    args: TArgs,
    page: TPage,
    builder: SelectQueryBuilder<Post & { feedMeta?: string }>,
    alias: string,
  ) => SelectQueryBuilder<Post & { feedMeta?: string }>,
  {
    removeHiddenPosts = true,
    removeBannedPosts = true,
    fetchQueryParams,
    warnOnPartialFirstPage = false,
    allowPrivateSources = true,
    allowSquadPosts = true,
  }: FeedResolverOptions<TArgs, TParams, TPage> = {},
): IFieldResolver<TSource, Context, TArgs> {
  return async (source, args, context, info): Promise<Connection<GQLPost>> => {
    const page = pageGenerator.connArgsToPage(args);
    const queryParams =
      fetchQueryParams &&
      (await runInSpan('feedResolver.fetchQueryParams', async () =>
        fetchQueryParams(context, args, page),
      ));
    const excludedTypes =
      queryParams && (queryParams as AnonymousFeedFilters).excludeTypes;

    const supportedTypes = args.supportedTypes?.filter((type) => {
      return excludedTypes ? !excludedTypes.includes(type) : true;
    });

    const result = await runInSpan('feedResolver.queryPaginated', async () =>
      graphorm.queryPaginated<GQLPost>(
        context,
        info,
        (nodeSize) =>
          pageGenerator.hasPreviousPage(page, nodeSize, undefined, queryParams),
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
            supportedTypes || ['article'],
            removeHiddenPosts,
            removeBannedPosts,
            allowPrivateSources,
            allowSquadPosts,
          );
          // console.log(builder.queryBuilder.getSql());
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
        ['article'],
        true,
        true,
        false,
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
  excludeTypes?: string[];
  includeTags?: string[];
  blockedTags?: string[];
  sourceIds?: string[];
  blockedContentCuration?: string[];
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

  newBuilder = newBuilder.andWhere(`${alias}."private" = false`);

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
        query: processSearchQuery(query),
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
): SelectQueryBuilder<Post> => {
  builder.andWhere(`${alias}.sourceId = :sourceId`, { sourceId });

  if (sourceId === 'community') {
    builder.andWhere(`${alias}.banned = false`);
  }

  return builder;
};

export const tagFeedBuilder = (
  ctx: Context,
  tag: string,
  builder: SelectQueryBuilder<Post>,
  alias: string,
): SelectQueryBuilder<Post> =>
  builder.andWhere((subBuilder) => whereTags([tag], subBuilder, alias));

export const fixedIdsFeedBuilder = (
  ctx: unknown,
  ids: string[],
  builder: SelectQueryBuilder<Post & { feedMeta?: string }>,
  alias: string,
): SelectQueryBuilder<Post & { feedMeta?: string }> => {
  // In case ids is empty make sure the query does not fail
  const idsStr = ids.length
    ? ids.map((id) => `'${id}'`).join(',')
    : `'nosuchid'`;
  return builder
    .andWhere(`${alias}.id IN (${idsStr})`)
    .orderBy(`array_position(array[${idsStr}], ${alias}.id)`);
};
