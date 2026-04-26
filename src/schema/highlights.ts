import { IResolvers } from '@graphql-tools/utils';
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
  }

  extend type Subscription {
    newHighlight: PostHighlight! @auth
  }
`;

const majorHeadlineSignificances = [
  PostHighlightSignificance.Breaking,
  PostHighlightSignificance.Major,
];

const defaultMajorHeadlinesLimit = 10;
const maxMajorHeadlinesLimit = 50;

const getMajorHeadlinesPage = (args: ConnectionArguments): OffsetPage => ({
  limit:
    Math.min(args.first || defaultMajorHeadlinesLimit, maxMajorHeadlinesLimit) +
    1,
  offset: getOffsetWithDefault(args.after, -1) + 1,
});

const addMajorHeadlineFilter = <T extends PostHighlight>(
  builder: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> =>
  builder
    .where('highlight.significance IN (:...significances)', {
      significances: majorHeadlineSignificances,
    })
    .andWhere('highlight."retiredAt" IS NULL');

const getDedupedMajorHeadlinesQuery = (
  queryBuilder: SelectQueryBuilder<PostHighlight>,
) =>
  addMajorHeadlineFilter(
    queryBuilder
      .subQuery()
      .select('highlight.id', 'id')
      .from(PostHighlight, 'highlight'),
  )
    .distinctOn(['highlight.postId'])
    .orderBy('highlight.postId', 'ASC')
    .addOrderBy('highlight.highlightedAt', 'DESC')
    .addOrderBy('highlight.id', 'DESC');

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
    majorHeadlines: async (
      _,
      args: ConnectionArguments,
      ctx: Context,
      info,
    ) => {
      const page = getMajorHeadlinesPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        () => page.offset > 0,
        (nodeSize) => nodeSize >= page.limit,
        (_, index) => offsetToCursor(page.offset + index),
        (builder) => {
          const dedupedIdsQuery = getDedupedMajorHeadlinesQuery(
            builder.queryBuilder as SelectQueryBuilder<PostHighlight>,
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
  PostHighlight: {
    post: async (source: GQLSubscribedPostHighlight, _, ctx: Context, info) =>
      graphorm.queryOne(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where(`${builder.alias}.id = :id`, {
            id: source.postId,
          });
          return builder;
        },
        true,
      ),
  },
};
