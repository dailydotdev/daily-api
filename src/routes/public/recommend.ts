import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import type { FeedConnection, PostNode } from './common';
import {
  parseLimit,
  ensureDbConnection,
  POST_NODE_FIELDS,
  PAGE_INFO_FIELDS,
} from './common';

const EXPERIMENTAL_HEADER = 'x-daily-experimental';
const EXPERIMENTAL_WARNING =
  'This endpoint is experimental and may be removed or changed without notice.';

const RECOMMEND_MAX_LIMIT = 20;
const SEARCH_VERSION = 3;

const KEYWORD_SEARCH_QUERY = `
  query PublicApiRecommendKeyword($query: String!, $first: Int, $after: String, $time: SearchTime, $version: Int) {
    searchPosts(query: $query, first: $first, after: $after, time: $time, version: $version) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

const SEMANTIC_SEARCH_QUERY = `
  query PublicApiRecommendSemantic($query: String!, $first: Int, $time: SearchTime, $version: Int) {
    searchPosts(query: $query, first: $first, time: $time, version: $version) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

type SearchPostsResponse = {
  searchPosts: FeedConnection<PostNode>;
};

const TIME_MAP: Record<string, string> = {
  day: 'Today',
  week: 'LastSevenDays',
  month: 'LastThirtyDays',
  year: 'ThisYear',
  all: 'AllTime',
};

export default async function (fastify: FastifyInstance): Promise<void> {
  // Option 1: Keyword-based recommendation
  // Best for: extracted technical terms, specific technology names
  fastify.get<{
    Querystring: { q: string; limit?: string; cursor?: string; time?: string };
  }>(
    '/keyword',
    {
      schema: {
        description:
          '[EXPERIMENTAL] Recommend articles by keyword search. Best when the query contains specific technical terms (e.g. "RAG", "pgvector", "LangChain"). Returns posts with engagement signals for LLM consumption. This endpoint may be removed or changed without notice.',
        tags: ['recommend'],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              description:
                'Search query — keywords or technical terms (e.g. "RAG vs fine-tuning", "vector database comparison")',
              minLength: 1,
            },
            limit: {
              type: 'integer',
              default: 10,
              maximum: 20,
              minimum: 1,
              description:
                'Number of articles to return (1-20, default 10). Kept small for LLM context efficiency.',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
            time: {
              type: 'string',
              enum: ['day', 'week', 'month', 'year', 'all'],
              description:
                'Time range filter — use "month" or "year" for recent content, "all" for comprehensive results',
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
      const limit = parseLimit(request.query.limit, RECOMMEND_MAX_LIMIT);
      const { cursor } = request.query;
      const con = ensureDbConnection(fastify.con);

      reply.header(EXPERIMENTAL_HEADER, EXPERIMENTAL_WARNING);

      return executeGraphql(
        con,
        {
          query: KEYWORD_SEARCH_QUERY,
          variables: {
            query: q,
            first: limit,
            after: cursor ?? null,
            time: time ? TIME_MAP[time] : null,
            version: SEARCH_VERSION,
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

  // Option 2: Semantic recommendation via Mimir
  // Best for: natural language questions, vague queries from non-technical users
  // Uses the same underlying Mimir search but framed for single-shot LLM consumption
  fastify.get<{
    Querystring: { q: string; limit?: string; time?: string };
  }>(
    '/semantic',
    {
      schema: {
        description:
          '[EXPERIMENTAL] Recommend articles by semantic search. Uses AI-powered matching to find articles for natural language questions. Better for non-technical queries like "how do I make my chatbot remember things?" This endpoint may be removed or changed without notice.',
        tags: ['recommend'],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              description:
                'Natural language question or topic (e.g. "how do I make my chatbot remember previous conversations?", "what is the best way to handle authentication in a Next.js app?")',
              minLength: 1,
            },
            limit: {
              type: 'integer',
              default: 10,
              maximum: 20,
              minimum: 1,
              description:
                'Number of articles to return (1-20, default 10). Kept small for LLM context efficiency.',
            },
            time: {
              type: 'string',
              enum: ['day', 'week', 'month', 'year', 'all'],
              description:
                'Time range filter — use "month" or "year" for recent content, "all" for comprehensive results',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'FeedPost#' } },
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
      const limit = parseLimit(request.query.limit, RECOMMEND_MAX_LIMIT);
      const con = ensureDbConnection(fastify.con);

      reply.header(EXPERIMENTAL_HEADER, EXPERIMENTAL_WARNING);

      return executeGraphql(
        con,
        {
          query: SEMANTIC_SEARCH_QUERY,
          variables: {
            query: q,
            first: limit,
            time: time ? TIME_MAP[time] : null,
            version: SEARCH_VERSION,
          },
        },
        (json) => {
          const result = json as unknown as SearchPostsResponse;
          return {
            data: result.searchPosts.edges.map(({ node }) => node),
          };
        },
        request,
        reply,
      );
    },
  );
}
