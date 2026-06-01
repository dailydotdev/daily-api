import { IResolvers } from '@graphql-tools/utils';
import type { GraphQLResolveInfo } from 'graphql';
import {
  ConnectionArguments,
  getOffsetWithDefault,
  offsetToCursor,
} from 'graphql-relay';
import type { SelectQueryBuilder } from 'typeorm';
import { BaseContext, Context } from '../Context';
import { NEW_HIGHLIGHT_CHANNEL } from '../common/highlights';
import graphorm from '../graphorm';
import { redisPubSub } from '../redis';
import type { OffsetPage } from './common';
import {
  PostHighlight,
  PostHighlightSignificance,
  toPostHighlightSignificance,
} from '../entity/PostHighlight';
import type { GQLSource } from './sources';

type GQLChannelDigestConfiguration = {
  frequency: string;
  source?: GQLSource | null;
};

type GQLChannelConfiguration = {
  channel: string;
  displayName: string;
  digest?: GQLChannelDigestConfiguration | null;
};

type GQLSubscribedPostHighlight = Pick<
  PostHighlight,
  | 'id'
  | 'post'
  | 'postId'
  | 'channel'
  | 'highlightedAt'
  | 'headline'
  | 'createdAt'
  | 'updatedAt'
>;

export const typeDefs = /* GraphQL */ `
  type ChannelDigestConfiguration {
    frequency: String!
    source: Source
  }

  type ChannelConfiguration {
    channel: String!
    displayName: String!
    digest: ChannelDigestConfiguration
  }

  type PostHighlight {
    id: ID!
    post: Post!
    channel: String!
    highlightedAt: DateTime!
    headline: String!
    significance: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PostHighlightEdge {
    node: PostHighlight!
    cursor: String!
  }

  type PostHighlightConnection {
    pageInfo: PageInfo!
    edges: [PostHighlightEdge!]!
  }

  extend type Query {
    """
    Get highlight-backed channel configuration with digest metadata
    """
    channelConfigurations: [ChannelConfiguration!]!

    """
    Get highlights for a channel, ordered by recency
    """
    postHighlights(channel: String!): [PostHighlight!]!

    """
    Get major headlines across all channels, deduplicated by post and ordered by recency
    """
    majorHeadlines(first: Int, after: String): PostHighlightConnection!

    """
    Get highlights deduplicated by post and ordered by recency.
    Accepts optional channel and significance filters so it can power per-channel,
    major-headlines and global feeds from a single endpoint.
    """
    postHighlightsFeed(
      channel: String
      significance: [String!]
      first: Int
      after: String
    ): PostHighlightConnection!
  }

  extend type Subscription {
    newHighlight: PostHighlight! @auth
  }
`;

const majorHeadlineSignificances = [
  PostHighlightSignificance.Breaking,
  PostHighlightSignificance.Major,
];

const defaultHighlightsLimit = 10;
const maxHighlightsLimit = 50;

const getHighlightsPage = (args: ConnectionArguments): OffsetPage => ({
  limit: Math.min(args.first || defaultHighlightsLimit, maxHighlightsLimit) + 1,
  offset: getOffsetWithDefault(args.after, -1) + 1,
});

type HighlightsFilters = {
  channel?: string | null;
  significances?: PostHighlightSignificance[];
};

const applyHighlightsFilters = <T extends PostHighlight>(
  builder: SelectQueryBuilder<T>,
  { channel, significances }: HighlightsFilters,
): SelectQueryBuilder<T> => {
  let qb = builder.where('highlight."retiredAt" IS NULL');

  if (significances && significances.length > 0) {
    qb = qb.andWhere('highlight.significance IN (:...significances)', {
      significances,
    });
  }

  if (channel) {
    qb = qb.andWhere('highlight.channel = :channel', { channel });
  }

  return qb;
};

const getDedupedHighlightsQuery = (
  queryBuilder: SelectQueryBuilder<PostHighlight>,
  filters: HighlightsFilters,
) =>
  applyHighlightsFilters(
    queryBuilder
      .subQuery()
      .select('highlight.id', 'id')
      .from(PostHighlight, 'highlight'),
    filters,
  )
    .distinctOn(['highlight.postId'])
    .orderBy('highlight.postId', 'ASC')
    .addOrderBy('highlight.highlightedAt', 'DESC')
    .addOrderBy('highlight.id', 'DESC');

const resolveDedupedHighlightsFeed = (
  ctx: Context,
  info: GraphQLResolveInfo,
  args: ConnectionArguments,
  filters: HighlightsFilters,
) => {
  const page = getHighlightsPage(args);

  return graphorm.queryPaginated(
    ctx,
    info,
    () => page.offset > 0,
    (nodeSize) => nodeSize >= page.limit,
    (_, index) => offsetToCursor(page.offset + index),
    (builder) => {
      const dedupedIdsQuery = getDedupedHighlightsQuery(
        builder.queryBuilder as SelectQueryBuilder<PostHighlight>,
        filters,
      );

      builder.queryBuilder
        .innerJoin(
          `(${dedupedIdsQuery.getQuery()})`,
          'deduped',
          `deduped.id = ${builder.alias}.id`,
        )
        .setParameters(dedupedIdsQuery.getParameters())
        .orderBy(`${builder.alias}."highlightedAt"`, 'DESC')
        .addOrderBy(`${builder.alias}."id"`, 'DESC')
        .offset(page.offset)
        .limit(page.limit);

      return builder;
    },
    (nodes) => nodes.slice(0, page.limit - 1),
    true,
  );
};

type PostHighlightsFeedArgs = ConnectionArguments & {
  channel?: string | null;
  significance?: string[] | null;
};

const parseSignificanceFilters = (
  values: string[] | null | undefined,
): PostHighlightSignificance[] =>
  (values ?? [])
    .map(toPostHighlightSignificance)
    .filter((value) => value !== PostHighlightSignificance.Unspecified);

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    channelConfigurations: async (_, __, ctx: Context, info) =>
      graphorm.query<GQLChannelConfiguration>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."mode" != :disabledMode`, {
              disabledMode: 'disabled',
            })
            .orderBy(`"${builder.alias}"."order"`, 'ASC')
            .addOrderBy(`"${builder.alias}"."channel"`, 'ASC');
          return builder;
        },
        true,
      ),
    postHighlights: async (_, args: { channel: string }, ctx: Context, info) =>
      graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."channel" = :channel`, {
              channel: args.channel,
            })
            .andWhere(`"${builder.alias}"."retiredAt" IS NULL`)
            .orderBy(`"${builder.alias}"."highlightedAt"`, 'DESC');
          return builder;
        },
        true,
      ),
    majorHeadlines: async (_, args: ConnectionArguments, ctx: Context, info) =>
      resolveDedupedHighlightsFeed(ctx, info, args, {
        significances: majorHeadlineSignificances,
      }),
    postHighlightsFeed: async (
      _,
      args: PostHighlightsFeedArgs,
      ctx: Context,
      info,
    ) =>
      resolveDedupedHighlightsFeed(ctx, info, args, {
        channel: args.channel,
        significances: parseSignificanceFilters(args.significance),
      }),
  },
  Subscription: {
    newHighlight: {
      subscribe: async (): Promise<
        AsyncIterable<{ newHighlight: GQLSubscribedPostHighlight }>
      > => {
        const iterator = redisPubSub.asyncIterator<GQLSubscribedPostHighlight>(
          NEW_HIGHLIGHT_CHANNEL,
        );

        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                const { done, value } = await iterator.next();
                if (done) {
                  return { done: true, value: undefined };
                }
                return { done: false, value: { newHighlight: value } };
              },
              return: async () => {
                await iterator.return?.();
                return { done: true, value: undefined };
              },
              throw: async (error: Error) => {
                await iterator.throw?.(error);
                return { done: true, value: undefined };
              },
            };
          },
        };
      },
    },
  },
};
