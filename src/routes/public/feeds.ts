import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import { getUserGrowthBookInstance } from '../../growthbook';
import {
  parseLimit,
  ensureDbConnection,
  POST_NODE_FIELDS,
  PAGE_INFO_FIELDS,
  FeedConnection,
  PostNode,
} from './common';

const DEFAULT_FEED_VERSION = 1;

// GraphQL query for the "For You" personalized feed
const FORYOU_FEED_QUERY = `
  query PublicApiFeed($first: Int, $after: String, $version: Int) {
    feed(first: $first, after: $after, ranking: POPULARITY, version: $version) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL query for popular feed (anonymous feed with popularity ranking)
const POPULAR_FEED_QUERY = `
  query PublicApiPopularFeed($first: Int, $after: String, $filters: FiltersInput) {
    anonymousFeed(first: $first, after: $after, ranking: POPULARITY, filters: $filters) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL query for most discussed feed
const MOST_DISCUSSED_FEED_QUERY = `
  query PublicApiMostDiscussedFeed($first: Int, $after: String, $period: Int, $tag: String, $source: ID) {
    mostDiscussedFeed(first: $first, after: $after, period: $period, tag: $tag, source: $source) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL query for tag feed
const TAG_FEED_QUERY = `
  query PublicApiTagFeed($tag: String!, $first: Int, $after: String) {
    tagFeed(tag: $tag, first: $first, after: $after, ranking: POPULARITY) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL query for source feed
const SOURCE_FEED_QUERY = `
  query PublicApiSourceFeed($source: ID!, $first: Int, $after: String) {
    sourceFeed(source: $source, first: $first, after: $after, ranking: POPULARITY) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

interface FeedResponse {
  data: {
    feed: FeedConnection<PostNode>;
  };
}

interface AnonymousFeedResponse {
  anonymousFeed: FeedConnection<PostNode>;
}

interface MostDiscussedFeedResponse {
  mostDiscussedFeed: FeedConnection<PostNode>;
}

interface TagFeedResponse {
  tagFeed: FeedConnection<PostNode>;
}

interface SourceFeedResponse {
  sourceFeed: FeedConnection<PostNode>;
}

export default async function (fastify: FastifyInstance): Promise<void> {
  // Get personalized "For You" feed
  fastify.get<{ Querystring: { limit?: string; cursor?: string } }>(
    '/foryou',
    {
      schema: {
        description: 'Get personalized "For You" feed',
        tags: ['feeds'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of posts to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'FeedPost#' } },
              pagination: { $ref: 'Pagination#' },
            },
          },
          401: { $ref: 'Error#' },
          403: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const { cursor } = request.query;
      const con = ensureDbConnection(fastify.con);

      // Get feed version from GrowthBook for the authenticated user
      const gb = getUserGrowthBookInstance(request.userId!);
      const feedVersion = gb.getFeatureValue(
        'feed_version',
        DEFAULT_FEED_VERSION,
      );

      return executeGraphql(
        con,
        {
          query: FORYOU_FEED_QUERY,
          variables: {
            first: limit,
            after: cursor ?? null,
            version: feedVersion,
          },
        },
        (json) => {
          const feed = (json as FeedResponse['data']).feed;
          return {
            data: feed.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: feed.pageInfo.hasNextPage,
              cursor: feed.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get popular feed (most upvoted)
  fastify.get<{
    Querystring: { limit?: string; cursor?: string; tags?: string };
  }>(
    '/popular',
    {
      schema: {
        description: 'Get popular feed (most upvoted posts)',
        tags: ['feeds'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of posts to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
            tags: {
              type: 'string',
              description: 'Comma-separated list of tags to filter by',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'FeedPost#' } },
              pagination: { $ref: 'Pagination#' },
            },
          },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const { cursor, tags } = request.query;
      const con = ensureDbConnection(fastify.con);
      const filters = tags ? { includeTags: tags.split(',') } : null;

      return executeGraphql(
        con,
        {
          query: POPULAR_FEED_QUERY,
          variables: {
            first: limit,
            after: cursor ?? null,
            filters,
          },
        },
        (json) => {
          const result = json as unknown as AnonymousFeedResponse;
          return {
            data: result.anonymousFeed.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.anonymousFeed.pageInfo.hasNextPage,
              cursor: result.anonymousFeed.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get most discussed feed
  fastify.get<{
    Querystring: {
      limit?: string;
      cursor?: string;
      period?: string;
      tag?: string;
      source?: string;
    };
  }>(
    '/discussed',
    {
      schema: {
        description: 'Get most discussed feed (posts with most comments)',
        tags: ['feeds'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of posts to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
            period: {
              type: 'integer',
              minimum: 1,
              maximum: 30,
              description: 'Number of days to look back (1-30)',
            },
            tag: {
              type: 'string',
              description: 'Filter by tag',
            },
            source: {
              type: 'string',
              description: 'Filter by source ID',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'FeedPost#' } },
              pagination: { $ref: 'Pagination#' },
            },
          },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const { cursor, tag, source } = request.query;
      const period = request.query.period
        ? parseInt(request.query.period, 10)
        : null;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: MOST_DISCUSSED_FEED_QUERY,
          variables: {
            first: limit,
            after: cursor ?? null,
            period,
            tag: tag ?? null,
            source: source ?? null,
          },
        },
        (json) => {
          const result = json as unknown as MostDiscussedFeedResponse;
          return {
            data: result.mostDiscussedFeed.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.mostDiscussedFeed.pageInfo.hasNextPage,
              cursor: result.mostDiscussedFeed.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get tag feed
  fastify.get<{
    Params: { tag: string };
    Querystring: { limit?: string; cursor?: string };
  }>(
    '/tag/:tag',
    {
      schema: {
        description: 'Get posts by tag',
        tags: ['feeds'],
        params: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Tag name' },
          },
          required: ['tag'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of posts to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'FeedPost#' } },
              pagination: { $ref: 'Pagination#' },
            },
          },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const { cursor } = request.query;
      const { tag } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: TAG_FEED_QUERY,
          variables: {
            tag,
            first: limit,
            after: cursor ?? null,
          },
        },
        (json) => {
          const result = json as unknown as TagFeedResponse;
          return {
            data: result.tagFeed.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.tagFeed.pageInfo.hasNextPage,
              cursor: result.tagFeed.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get source feed
  fastify.get<{
    Params: { source: string };
    Querystring: { limit?: string; cursor?: string };
  }>(
    '/source/:source',
    {
      schema: {
        description: 'Get posts by source',
        tags: ['feeds'],
        params: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source ID or handle' },
          },
          required: ['source'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of posts to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'FeedPost#' } },
              pagination: { $ref: 'Pagination#' },
            },
          },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const { cursor } = request.query;
      const { source } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: SOURCE_FEED_QUERY,
          variables: {
            source,
            first: limit,
            after: cursor ?? null,
          },
        },
        (json) => {
          const result = json as unknown as SourceFeedResponse;
          return {
            data: result.sourceFeed.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.sourceFeed.pageInfo.hasNextPage,
              cursor: result.sourceFeed.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );
}
