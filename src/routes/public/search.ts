import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import type { FeedConnection, PostNode } from './common';
import {
  parseLimit,
  ensureDbConnection,
  POST_NODE_FIELDS,
  PAGE_INFO_FIELDS,
} from './common';

// GraphQL query for searching posts
const SEARCH_POSTS_QUERY = `
  query PublicApiSearchPosts($query: String!, $first: Int, $after: String, $time: SearchTime) {
    searchPosts(query: $query, first: $first, after: $after, time: $time) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL query for searching tags
const SEARCH_TAGS_QUERY = `
  query PublicApiSearchTags($query: String!) {
    searchTags(query: $query) {
      query
      hits {
        name
      }
    }
  }
`;

// GraphQL query for searching sources
const SEARCH_SOURCES_QUERY = `
  query PublicApiSearchSources($query: String!, $limit: Int) {
    searchSources(query: $query, limit: $limit) {
      id
      name
      handle
      image
      description
    }
  }
`;

interface SearchPostsResponse {
  searchPosts: FeedConnection<PostNode>;
}

interface SearchTagsResponse {
  searchTags: {
    query: string;
    hits: { name: string }[];
  };
}

interface SourceSummary {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  description: string | null;
}

interface SearchSourcesResponse {
  searchSources: SourceSummary[];
}

// Map API time values to GraphQL enum values
const TIME_MAP: Record<string, string> = {
  day: 'DAY',
  week: 'WEEK',
  month: 'MONTH',
  year: 'YEAR',
  all: 'ALL',
};

export default async function (fastify: FastifyInstance): Promise<void> {
  // Search posts
  fastify.get<{
    Querystring: { q: string; limit?: string; cursor?: string; time?: string };
  }>(
    '/posts',
    {
      schema: {
        description: 'Search posts by keyword',
        tags: ['search'],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              description: 'Search query (required)',
              minLength: 1,
            },
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
            time: {
              type: 'string',
              enum: ['day', 'week', 'month', 'year', 'all'],
              description: 'Time range filter (day, week, month, year, all)',
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
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { q, time } = request.query;
      const limit = parseLimit(request.query.limit);
      const { cursor } = request.query;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: SEARCH_POSTS_QUERY,
          variables: {
            query: q,
            first: limit,
            after: cursor ?? null,
            time: time ? TIME_MAP[time] : null,
          },
        },
        (json) => {
          const result = json as unknown as SearchPostsResponse;
          return {
            data: result.searchPosts.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.searchPosts.pageInfo.hasNextPage,
              cursor: result.searchPosts.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Search tags
  fastify.get<{ Querystring: { q: string } }>(
    '/tags',
    {
      schema: {
        description: 'Search tags by name',
        tags: ['search'],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              description: 'Search query (required)',
              minLength: 1,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'Tag#' } },
            },
          },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { q } = request.query;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: SEARCH_TAGS_QUERY,
          variables: { query: q },
        },
        (json) => {
          const result = json as unknown as SearchTagsResponse;
          return {
            data: result.searchTags.hits,
          };
        },
        request,
        reply,
      );
    },
  );

  // Search sources
  fastify.get<{ Querystring: { q: string; limit?: string } }>(
    '/sources',
    {
      schema: {
        description: 'Search sources/publishers by name',
        tags: ['search'],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              description: 'Search query (required)',
              minLength: 1,
            },
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of sources to return (1-50)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'SourceSummary#' } },
            },
          },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { q } = request.query;
      const limit = parseLimit(request.query.limit);
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: SEARCH_SOURCES_QUERY,
          variables: { query: q, limit },
        },
        (json) => {
          const result = json as unknown as SearchSourcesResponse;
          return {
            data: result.searchSources,
          };
        },
        request,
        reply,
      );
    },
  );
}
