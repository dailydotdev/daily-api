import { IResolvers } from '@graphql-tools/utils';
import type { GraphQLResolveInfo } from 'graphql';
import {
  ConnectionArguments,
  getOffsetWithDefault,
  offsetToCursor,
} from 'graphql-relay';
import type { SelectQueryBuilder } from 'typeorm';
import { AuthContext, BaseContext, Context } from '../Context';
import { NEW_HIGHLIGHT_CHANNEL } from '../common/highlights';
import graphorm from '../graphorm';
import { redisPubSub } from '../redis';
import type { OffsetPage } from './common';
import { HighlightsCanonical } from '../entity/HighlightsCanonical';
import {
  HighlightSignificance,
  toHighlightSignificance,
} from '../common/channelHighlight/significance';
import type { GQLSource } from './sources';
import { ChannelDigest } from '../entity/ChannelDigest';
import { ContentPreferenceSource } from '../entity/contentPreference/ContentPreferenceSource';
import { ContentPreferenceStatus } from '../entity/contentPreference/types';
import { queryReadReplica } from '../common/queryReadReplica';
import { Post, PostType } from '../entity/posts/Post';
import { ONE_DAY_IN_SECONDS } from '../common/constants';

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
  HighlightsCanonical,
  | 'id'
  | 'post'
  | 'postId'
  | 'highlightedAt'
  | 'headline'
  | 'createdAt'
  | 'updatedAt'
> & { channel: string };

export const typeDefs = /* GraphQL */ `
  type ChannelDigestConfiguration {
    frequency: String!
    source: Source
  }

  type ChannelConfiguration {
    channel: String!
    displayName: String!
    color: String!
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

  """
  Lean per-post hero card payload. Backed by post_hero MV that unions
  editorial highlights with algorithmic lifecycle states (breakout, evergreen).
  """
  type PostHero {
    id: ID!
    headline: String!
    significance: String!
    size: Int!
    highlightedAt: DateTime!
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
    Get all enabled channel digest configurations, ordered by channel and key
    """
    channelDigestConfigurations: [ChannelDigestConfiguration!]!

    """
    Get highlights for a channel, ordered by recency
    """
    postHighlights(channel: String!): [PostHighlight!]!

    """
    Get major canonical headlines across all channels, ordered by recency
    """
    majorHeadlines(first: Int, after: String): PostHighlightConnection!

    """
    Get canonical highlights ordered by recency.
    Accepts optional channel and significance filters for channel-specific and
    global feeds from a single endpoint.
    """
    postHighlightsFeed(
      channel: String
      significance: [String!]
      first: Int
      after: String
    ): PostHighlightConnection!

    """
    Get the latest digest post from the last 24 hours for each channel digest
    whose source the current user follows, one per channel, ordered by recency.
    """
    dailyHeadlines(first: Int, after: String): PostConnection! @auth
  }

  extend type Subscription {
    newHighlight: PostHighlight! @auth
  }
`;

const majorHeadlineSignificances = [
  HighlightSignificance.Breaking,
  HighlightSignificance.Major,
];

const defaultHighlightsLimit = 10;
const maxHighlightsLimit = 50;

const getHighlightsPage = (args: ConnectionArguments): OffsetPage => ({
  limit: Math.min(args.first || defaultHighlightsLimit, maxHighlightsLimit) + 1,
  offset: getOffsetWithDefault(args.after, -1) + 1,
});

type HighlightsFilters = {
  channel?: string | null;
  significances?: HighlightSignificance[];
};

const applyHighlightsFilters = <T extends HighlightsCanonical>(
  builder: SelectQueryBuilder<T>,
  alias: string,
  { channel, significances }: HighlightsFilters,
): SelectQueryBuilder<T> => {
  builder.setParameter('highlightChannel', channel ?? null);

  if (significances && significances.length > 0) {
    builder.andWhere(`"${alias}"."significance" IN (:...significances)`, {
      significances,
    });
  }

  if (channel) {
    builder.andWhere(`:highlightChannel = ANY("${alias}"."channels")`);
  }

  return builder;
};

const resolveCanonicalHighlightsFeed = (
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
      builder.queryBuilder = applyHighlightsFilters(
        builder.queryBuilder as SelectQueryBuilder<HighlightsCanonical>,
        builder.alias,
        filters,
      )
        .orderBy(`"${builder.alias}"."highlightedAt"`, 'DESC')
        .addOrderBy(`"${builder.alias}"."id"`, 'DESC')
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
): HighlightSignificance[] =>
  (values ?? [])
    .map(toHighlightSignificance)
    .filter((value) => value !== HighlightSignificance.Unspecified);

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
    channelDigestConfigurations: async (_, __, ctx: Context, info) =>
      graphorm.query<GQLChannelDigestConfiguration>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."enabled" = true`)
            .orderBy(`"${builder.alias}"."channel"`, 'ASC')
            .addOrderBy(`"${builder.alias}"."key"`, 'ASC');
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
            .where(`:highlightChannel = ANY("${builder.alias}"."channels")`, {
              highlightChannel: args.channel,
            })
            .orderBy(`"${builder.alias}"."highlightedAt"`, 'DESC')
            .addOrderBy(`"${builder.alias}"."id"`, 'DESC');
          return builder;
        },
        true,
      ),
    majorHeadlines: async (_, args: ConnectionArguments, ctx: Context, info) =>
      resolveCanonicalHighlightsFeed(ctx, info, args, {
        significances: majorHeadlineSignificances,
      }),
    postHighlightsFeed: async (
      _,
      args: PostHighlightsFeedArgs,
      ctx: Context,
      info,
    ) =>
      resolveCanonicalHighlightsFeed(ctx, info, args, {
        channel: args.channel,
        significances: parseSignificanceFilters(args.significance),
      }),
    dailyHeadlines: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info,
    ) => {
      const since = new Date(Date.now() - ONE_DAY_IN_SECONDS * 1000);
      const latestDigestPerChannel = await queryReadReplica(
        ctx.con,
        ({ queryRunner }) =>
          queryRunner.manager
            .getRepository(ContentPreferenceSource)
            .createQueryBuilder('cp')
            .select('p.id', 'id')
            .innerJoin(
              ChannelDigest,
              'cd',
              'cd."sourceId" = cp."referenceId" AND cd.enabled = true',
            )
            .innerJoin(
              Post,
              'p',
              'p."sourceId" = cd."sourceId" AND p.type = :postType AND p.visible = true AND p.deleted = false AND p."createdAt" >= :since',
              { postType: PostType.Freeform, since },
            )
            .where('cp."userId" = :userId AND cp."feedId" = :userId', {
              userId: ctx.userId,
            })
            .andWhere('cp.status != :blocked', {
              blocked: ContentPreferenceStatus.Blocked,
            })
            .distinctOn(['cd."sourceId"'])
            .orderBy('cd."sourceId"', 'ASC')
            .addOrderBy('p."createdAt"', 'DESC')
            .getRawMany<{ id: string }>(),
      );

      const postIds = latestDigestPerChannel.map((row) => row.id);
      const page = getHighlightsPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        () => page.offset > 0,
        (nodeSize) => nodeSize >= page.limit,
        (_, index) => offsetToCursor(page.offset + index),
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."id" IN (:...postIds)`, {
              postIds: postIds.length ? postIds : ['nosuchid'],
            })
            .orderBy(`"${builder.alias}"."createdAt"`, 'DESC')
            .addOrderBy(`"${builder.alias}"."id"`, 'DESC')
            .offset(page.offset)
            .limit(page.limit);
          return builder;
        },
        (nodes) => nodes.slice(0, page.limit - 1),
        true,
      );
    },
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
