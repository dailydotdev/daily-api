import { ValidationError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import type { Context } from '../Context';
import { NotFoundError } from '../errors';
import graphorm from '../graphorm';
import { HttpError } from '../integrations/retry';
import { yggdrasilSentimentClient } from '../integrations/yggdrasil/clients';
import type {
  HighlightsResponse,
  TimeSeriesResponse,
  XSearchAuthor,
  XSearchMetrics,
} from '../integrations/yggdrasil/types';

type SentimentResolution = 'QUARTER_HOUR' | 'HOUR' | 'DAY';
type SentimentHighlightsOrderBy = 'SCORE' | 'RECENCY';
type SentimentResolverObject = {
  __provider?: string;
};

const PROVIDER_AUTHOR_TYPE: Record<string, string> = {
  x_search: 'SentimentAuthorX',
};

const PROVIDER_METRICS_TYPE: Record<string, string> = {
  x_search: 'SentimentMetricsX',
};

const defaultHighlightsLimit = 20;
const minHighlightsLimit = 1;
const maxHighlightsLimit = 50;

const mapResolutionEnum = (
  resolution: SentimentResolution,
): '15m' | '1h' | '1d' => {
  switch (resolution) {
    case 'QUARTER_HOUR':
      return '15m';
    case 'HOUR':
      return '1h';
    case 'DAY':
      return '1d';
  }
};

const mapOrderByEnum = (
  orderBy?: SentimentHighlightsOrderBy,
): 'score' | 'recency' | undefined => {
  switch (orderBy) {
    case 'SCORE':
      return 'score';
    case 'RECENCY':
      return 'recency';
    default:
      return undefined;
  }
};

const validateSentimentFilter = ({
  entity,
  groupId,
}: {
  entity?: string;
  groupId?: string;
}): void => {
  const hasEntity = !!entity;
  const hasGroupId = !!groupId;

  if ((hasEntity && hasGroupId) || (!hasEntity && !hasGroupId)) {
    throw new ValidationError('Exactly one of entity or groupId must be set');
  }
};

const validateHighlightsFirst = (first?: number): number => {
  if (first == null) {
    return defaultHighlightsLimit;
  }

  if (first < minHighlightsLimit || first > maxHighlightsLimit) {
    throw new ValidationError(
      `first must be between ${minHighlightsLimit} and ${maxHighlightsLimit}`,
    );
  }

  return first;
};

const transformAuthor = (raw: XSearchAuthor) => ({
  id: raw.id,
  name: raw.name,
  handle: raw.handle,
  avatarUrl: raw.avatar_url,
});

const transformMetrics = (raw: XSearchMetrics) => ({
  likeCount: raw.like_count,
  replyCount: raw.reply_count,
  retweetCount: raw.retweet_count,
  quoteCount: raw.quote_count,
  bookmarkCount: raw.bookmark_count,
  impressionCount: raw.impression_count,
});

const transformTimeSeries = (data: TimeSeriesResponse) => ({
  start: data.start,
  resolutionSeconds: data.resolution_seconds,
  entities: {
    nodes: Object.entries(data.entities || {}).map(([entity, series]) => ({
      entity,
      timestamps: series.t,
      scores: series.s,
      volume: series.v,
      scoreVariance: series.sv ?? [],
    })),
  },
});

const transformHighlights = (data: HighlightsResponse) => ({
  items: (data.items || []).map((item) => ({
    provider: item.provider,
    externalItemId: item.external_item_id,
    url: item.url,
    text: item.text,
    author: item.author
      ? {
          __provider: item.provider,
          ...transformAuthor(item.author),
        }
      : null,
    metrics: item.metrics
      ? {
          __provider: item.provider,
          ...transformMetrics(item.metrics),
        }
      : null,
    createdAt: item.created_at,
    sentiments: (item.sentiments || []).map((sentiment) => ({
      entity: sentiment.entity,
      score: sentiment.score,
      highlightScore: sentiment.highlight_score,
    })),
  })),
  cursor: data.cursor,
});

export const typeDefs = /* GraphQL */ `
  enum SentimentResolution {
    QUARTER_HOUR
    HOUR
    DAY
  }

  enum SentimentHighlightsOrderBy {
    SCORE
    RECENCY
  }

  type SentimentEntityTimeSeries {
    entity: String!
    timestamps: [Int!]!
    scores: [Float!]!
    volume: [Int!]!
    scoreVariance: [Float!]!
  }

  type SentimentEntityTimeSeriesData {
    nodes: [SentimentEntityTimeSeries!]!
  }

  type SentimentTimeSeries {
    start: Int!
    resolutionSeconds: Int!
    entities: SentimentEntityTimeSeriesData!
  }

  type SentimentAuthorX {
    id: String
    name: String
    handle: String
    avatarUrl: String
  }

  union SentimentHighlightAuthor = SentimentAuthorX

  type SentimentMetricsX {
    likeCount: Int
    replyCount: Int
    retweetCount: Int
    quoteCount: Int
    bookmarkCount: Int
    impressionCount: Int
  }

  union SentimentHighlightMetrics = SentimentMetricsX

  type SentimentAnnotation {
    entity: String!
    score: Float!
    highlightScore: Float!
  }

  type SentimentHighlightItem {
    provider: String!
    externalItemId: String!
    url: String!
    text: String!
    author: SentimentHighlightAuthor
    metrics: SentimentHighlightMetrics
    createdAt: DateTime!
    sentiments: [SentimentAnnotation!]!
  }

  type SentimentHighlightsConnection {
    items: [SentimentHighlightItem!]!
    cursor: String
  }

  type SentimentEntity {
    entity: String!
    name: String!
    logo: String!
  }

  type SentimentGroup {
    id: ID!
    name: String!
    entities: [SentimentEntity!]!
  }

  extend type Query {
    sentimentTimeSeries(
      resolution: SentimentResolution!
      entity: String
      groupId: ID
      lookback: String
    ): SentimentTimeSeries! @rateLimit(limit: 30, duration: 60)

    sentimentHighlights(
      entity: String
      groupId: ID
      first: Int
      after: String
      orderBy: SentimentHighlightsOrderBy
    ): SentimentHighlightsConnection! @rateLimit(limit: 30, duration: 60)

    sentimentGroup(id: ID!): SentimentGroup
  }
`;

export const resolvers: IResolvers<unknown, Context> = {
  Query: {
    sentimentTimeSeries: async (
      _,
      args: {
        resolution: SentimentResolution;
        entity?: string;
        groupId?: string;
        lookback?: string;
      },
    ) => {
      validateSentimentFilter({ entity: args.entity, groupId: args.groupId });

      try {
        const data = await yggdrasilSentimentClient.getTimeSeries({
          resolution: mapResolutionEnum(args.resolution),
          entity: args.entity,
          groupId: args.groupId,
          lookback: args.lookback,
        });

        return transformTimeSeries(data);
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 404) {
          throw new NotFoundError('Sentiment series target not found');
        }

        throw error;
      }
    },

    sentimentHighlights: async (
      _,
      args: {
        entity?: string;
        groupId?: string;
        first?: number;
        after?: string;
        orderBy?: SentimentHighlightsOrderBy;
      },
    ) => {
      validateSentimentFilter({ entity: args.entity, groupId: args.groupId });
      const first = validateHighlightsFirst(args.first);

      try {
        const data = await yggdrasilSentimentClient.getHighlights({
          entity: args.entity,
          groupId: args.groupId,
          limit: first,
          after: args.after,
          orderBy: mapOrderByEnum(args.orderBy),
        });

        return transformHighlights(data);
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 404) {
          throw new NotFoundError('Sentiment highlights target not found');
        }

        throw error;
      }
    },
    sentimentGroup: async (_, { id }: { id: string }, ctx, info) => {
      return graphorm.queryOne(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where(`${builder.alias}.id = :id`, { id });
          return builder;
        },
        true,
      );
    },
  },

  SentimentHighlightAuthor: {
    __resolveType: (obj: SentimentResolverObject) => {
      const provider = obj.__provider ?? '';
      return PROVIDER_AUTHOR_TYPE[provider] ?? 'SentimentAuthorX';
    },
  },

  SentimentHighlightMetrics: {
    __resolveType: (obj: SentimentResolverObject) => {
      const provider = obj.__provider ?? '';
      return PROVIDER_METRICS_TYPE[provider] ?? 'SentimentMetricsX';
    },
  },
};
