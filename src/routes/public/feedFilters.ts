import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import {
  ensureDbConnection,
  FEED_SETTINGS_FIELDS,
  FeedSettingsType,
} from './common';

// GraphQL queries
const FEED_SETTINGS_QUERY = `
  query PublicApiFeedSettings($feedId: ID) {
    feedSettings(feedId: $feedId) {
      ${FEED_SETTINGS_FIELDS}
    }
  }
`;

// GraphQL mutations
const ADD_FILTERS_TO_FEED_MUTATION = `
  mutation PublicApiAddFiltersToFeed($feedId: ID, $filters: FiltersInput!) {
    addFiltersToFeed(feedId: $feedId, filters: $filters) {
      ${FEED_SETTINGS_FIELDS}
    }
  }
`;

const REMOVE_FILTERS_FROM_FEED_MUTATION = `
  mutation PublicApiRemoveFiltersFromFeed($feedId: ID, $filters: FiltersInput!) {
    removeFiltersFromFeed(feedId: $feedId, filters: $filters) {
      ${FEED_SETTINGS_FIELDS}
    }
  }
`;

// Response types
interface FeedSettingsResponse {
  feedSettings: FeedSettingsType;
}

// Helper to build filter mutation call
const buildFilterMutation = (
  fastify: FastifyInstance,
  query: string,
  feedId: string | null,
  filters: Record<string, unknown>,
  request: unknown,
  reply: unknown,
) => {
  const con = ensureDbConnection(fastify.con);

  return executeGraphql(
    con,
    {
      query,
      variables: {
        feedId,
        filters,
      },
    },
    () => ({ success: true }),
    request as Parameters<typeof executeGraphql>[3],
    reply as Parameters<typeof executeGraphql>[4],
  );
};

export default async function (fastify: FastifyInstance): Promise<void> {
  // ============================================================================
  // Global Feed Filters (For You feed)
  // ============================================================================

  // Get global feed settings
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get global feed settings (For You feed)',
        tags: ['feed-filters'],
        response: {
          200: { $ref: 'FeedSettings#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: FEED_SETTINGS_QUERY,
          variables: { feedId: null },
        },
        (json) => {
          const result = json as unknown as FeedSettingsResponse;
          return result.feedSettings;
        },
        request,
        reply,
      );
    },
  );

  // Follow tags globally
  fastify.post<{ Body: { tags: string[] } }>(
    '/tags/follow',
    {
      schema: {
        description: 'Follow tags globally (For You feed)',
        tags: ['feed-filters'],
        body: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag names to follow',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        ADD_FILTERS_TO_FEED_MUTATION,
        null,
        { includeTags: request.body.tags },
        request,
        reply,
      );
    },
  );

  // Unfollow tags globally
  fastify.post<{ Body: { tags: string[] } }>(
    '/tags/unfollow',
    {
      schema: {
        description: 'Unfollow tags globally (For You feed)',
        tags: ['feed-filters'],
        body: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag names to unfollow',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        REMOVE_FILTERS_FROM_FEED_MUTATION,
        null,
        { includeTags: request.body.tags },
        request,
        reply,
      );
    },
  );

  // Block tags globally
  fastify.post<{ Body: { tags: string[] } }>(
    '/tags/block',
    {
      schema: {
        description: 'Block tags globally (For You feed)',
        tags: ['feed-filters'],
        body: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag names to block',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        ADD_FILTERS_TO_FEED_MUTATION,
        null,
        { blockedTags: request.body.tags },
        request,
        reply,
      );
    },
  );

  // Unblock tags globally
  fastify.post<{ Body: { tags: string[] } }>(
    '/tags/unblock',
    {
      schema: {
        description: 'Unblock tags globally (For You feed)',
        tags: ['feed-filters'],
        body: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag names to unblock',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        REMOVE_FILTERS_FROM_FEED_MUTATION,
        null,
        { blockedTags: request.body.tags },
        request,
        reply,
      );
    },
  );

  // Follow sources globally
  fastify.post<{ Body: { sources: string[] } }>(
    '/sources/follow',
    {
      schema: {
        description: 'Follow sources globally (For You feed)',
        tags: ['feed-filters'],
        body: {
          type: 'object',
          required: ['sources'],
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs to follow',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        ADD_FILTERS_TO_FEED_MUTATION,
        null,
        { includeSources: request.body.sources },
        request,
        reply,
      );
    },
  );

  // Unfollow sources globally
  fastify.post<{ Body: { sources: string[] } }>(
    '/sources/unfollow',
    {
      schema: {
        description: 'Unfollow sources globally (For You feed)',
        tags: ['feed-filters'],
        body: {
          type: 'object',
          required: ['sources'],
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs to unfollow',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        REMOVE_FILTERS_FROM_FEED_MUTATION,
        null,
        { includeSources: request.body.sources },
        request,
        reply,
      );
    },
  );

  // Block sources globally
  fastify.post<{ Body: { sources: string[] } }>(
    '/sources/block',
    {
      schema: {
        description: 'Block sources globally (For You feed)',
        tags: ['feed-filters'],
        body: {
          type: 'object',
          required: ['sources'],
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs to block',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        ADD_FILTERS_TO_FEED_MUTATION,
        null,
        { excludeSources: request.body.sources },
        request,
        reply,
      );
    },
  );

  // Unblock sources globally
  fastify.post<{ Body: { sources: string[] } }>(
    '/sources/unblock',
    {
      schema: {
        description: 'Unblock sources globally (For You feed)',
        tags: ['feed-filters'],
        body: {
          type: 'object',
          required: ['sources'],
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs to unblock',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        REMOVE_FILTERS_FROM_FEED_MUTATION,
        null,
        { excludeSources: request.body.sources },
        request,
        reply,
      );
    },
  );

  // ============================================================================
  // Per-Feed Filters (Custom Feeds)
  // ============================================================================

  // Get custom feed settings
  fastify.get<{ Params: { feedId: string } }>(
    '/:feedId',
    {
      schema: {
        description: 'Get custom feed filter settings',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        response: {
          200: { $ref: 'FeedSettings#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { feedId } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: FEED_SETTINGS_QUERY,
          variables: { feedId },
        },
        (json) => {
          const result = json as unknown as FeedSettingsResponse;
          return result.feedSettings;
        },
        request,
        reply,
      );
    },
  );

  // Follow tags for custom feed
  fastify.post<{ Params: { feedId: string }; Body: { tags: string[] } }>(
    '/:feedId/tags/follow',
    {
      schema: {
        description: 'Follow tags for a custom feed',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag names to follow',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        ADD_FILTERS_TO_FEED_MUTATION,
        request.params.feedId,
        { includeTags: request.body.tags },
        request,
        reply,
      );
    },
  );

  // Unfollow tags for custom feed
  fastify.post<{ Params: { feedId: string }; Body: { tags: string[] } }>(
    '/:feedId/tags/unfollow',
    {
      schema: {
        description: 'Unfollow tags for a custom feed',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag names to unfollow',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        REMOVE_FILTERS_FROM_FEED_MUTATION,
        request.params.feedId,
        { includeTags: request.body.tags },
        request,
        reply,
      );
    },
  );

  // Block tags for custom feed
  fastify.post<{ Params: { feedId: string }; Body: { tags: string[] } }>(
    '/:feedId/tags/block',
    {
      schema: {
        description: 'Block tags for a custom feed',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag names to block',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        ADD_FILTERS_TO_FEED_MUTATION,
        request.params.feedId,
        { blockedTags: request.body.tags },
        request,
        reply,
      );
    },
  );

  // Unblock tags for custom feed
  fastify.post<{ Params: { feedId: string }; Body: { tags: string[] } }>(
    '/:feedId/tags/unblock',
    {
      schema: {
        description: 'Unblock tags for a custom feed',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag names to unblock',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        REMOVE_FILTERS_FROM_FEED_MUTATION,
        request.params.feedId,
        { blockedTags: request.body.tags },
        request,
        reply,
      );
    },
  );

  // Follow sources for custom feed
  fastify.post<{ Params: { feedId: string }; Body: { sources: string[] } }>(
    '/:feedId/sources/follow',
    {
      schema: {
        description: 'Follow sources for a custom feed',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['sources'],
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs to follow',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        ADD_FILTERS_TO_FEED_MUTATION,
        request.params.feedId,
        { includeSources: request.body.sources },
        request,
        reply,
      );
    },
  );

  // Unfollow sources for custom feed
  fastify.post<{ Params: { feedId: string }; Body: { sources: string[] } }>(
    '/:feedId/sources/unfollow',
    {
      schema: {
        description: 'Unfollow sources for a custom feed',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['sources'],
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs to unfollow',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        REMOVE_FILTERS_FROM_FEED_MUTATION,
        request.params.feedId,
        { includeSources: request.body.sources },
        request,
        reply,
      );
    },
  );

  // Block sources for custom feed
  fastify.post<{ Params: { feedId: string }; Body: { sources: string[] } }>(
    '/:feedId/sources/block',
    {
      schema: {
        description: 'Block sources for a custom feed',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['sources'],
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs to block',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        ADD_FILTERS_TO_FEED_MUTATION,
        request.params.feedId,
        { excludeSources: request.body.sources },
        request,
        reply,
      );
    },
  );

  // Unblock sources for custom feed
  fastify.post<{ Params: { feedId: string }; Body: { sources: string[] } }>(
    '/:feedId/sources/unblock',
    {
      schema: {
        description: 'Unblock sources for a custom feed',
        tags: ['feed-filters'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['sources'],
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs to unblock',
            },
          },
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      return buildFilterMutation(
        fastify,
        REMOVE_FILTERS_FROM_FEED_MUTATION,
        request.params.feedId,
        { excludeSources: request.body.sources },
        request,
        reply,
      );
    },
  );
}
