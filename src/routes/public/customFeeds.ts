import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import {
  parseLimit,
  ensureDbConnection,
  CUSTOM_FEED_FIELDS,
  POST_NODE_FIELDS,
  PAGE_INFO_FIELDS,
  CustomFeed,
  CustomFeedConnection,
  FeedConnection,
  PostNode,
} from './common';

// GraphQL queries
const FEED_LIST_QUERY = `
  query PublicApiFeedList($first: Int, $after: String) {
    feedList(first: $first, after: $after) {
      edges {
        node {
          ${CUSTOM_FEED_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

const GET_FEED_QUERY = `
  query PublicApiGetFeed($feedId: ID!) {
    getFeed(feedId: $feedId) {
      ${CUSTOM_FEED_FIELDS}
    }
  }
`;

const CUSTOM_FEED_POSTS_QUERY = `
  query PublicApiCustomFeed($feedId: ID!, $first: Int, $after: String, $ranking: Ranking, $version: Int) {
    customFeed(feedId: $feedId, first: $first, after: $after, ranking: $ranking, version: $version) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL mutations
const CREATE_FEED_MUTATION = `
  mutation PublicApiCreateFeed($name: String!, $icon: String, $orderBy: FeedOrderBy, $minDayRange: Int, $minUpvotes: Int, $minViews: Int, $disableEngagementFilter: Boolean) {
    createFeed(name: $name, icon: $icon, orderBy: $orderBy, minDayRange: $minDayRange, minUpvotes: $minUpvotes, minViews: $minViews, disableEngagementFilter: $disableEngagementFilter) {
      ${CUSTOM_FEED_FIELDS}
    }
  }
`;

const UPDATE_FEED_MUTATION = `
  mutation PublicApiUpdateFeed($feedId: ID!, $name: String!, $icon: String, $orderBy: FeedOrderBy, $minDayRange: Int, $minUpvotes: Int, $minViews: Int, $disableEngagementFilter: Boolean) {
    updateFeed(feedId: $feedId, name: $name, icon: $icon, orderBy: $orderBy, minDayRange: $minDayRange, minUpvotes: $minUpvotes, minViews: $minViews, disableEngagementFilter: $disableEngagementFilter) {
      ${CUSTOM_FEED_FIELDS}
    }
  }
`;

const DELETE_FEED_MUTATION = `
  mutation PublicApiDeleteFeed($feedId: ID!) {
    deleteFeed(feedId: $feedId) {
      _
    }
  }
`;

const UPDATE_FEED_ADVANCED_SETTINGS_MUTATION = `
  mutation PublicApiUpdateFeedAdvancedSettings($feedId: ID, $settings: [FeedAdvancedSettingsInput]!) {
    updateFeedAdvancedSettings(feedId: $feedId, settings: $settings) {
      id
      enabled
    }
  }
`;

// Response types
interface FeedListResponse {
  feedList: CustomFeedConnection;
}

interface GetFeedResponse {
  getFeed: CustomFeed | null;
}

interface CustomFeedPostsResponse {
  customFeed: FeedConnection<PostNode>;
}

interface CreateFeedResponse {
  createFeed: CustomFeed;
}

interface UpdateFeedResponse {
  updateFeed: CustomFeed;
}

interface UpdateFeedAdvancedSettingsResponse {
  updateFeedAdvancedSettings: { id: number; enabled: boolean }[];
}

export default async function (fastify: FastifyInstance): Promise<void> {
  // Create a new custom feed
  fastify.post<{
    Body: {
      name: string;
      icon?: string;
      orderBy?: string;
      minDayRange?: number;
      minUpvotes?: number;
      minViews?: number;
      disableEngagementFilter?: boolean;
    };
  }>(
    '/',
    {
      schema: {
        description: 'Create a new custom feed',
        tags: ['custom-feeds'],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', description: 'Name of the feed' },
            icon: { type: 'string', description: 'Icon emoji for the feed' },
            orderBy: {
              type: 'string',
              enum: ['DATE', 'UPVOTES', 'DOWNVOTES', 'COMMENTS', 'CLICKS'],
              description: 'Sort order for the feed (defaults to algorithmic ranking if not provided)',
            },
            minDayRange: {
              type: 'integer',
              description: 'Minimum day range filter',
            },
            minUpvotes: {
              type: 'integer',
              description: 'Minimum upvotes filter',
            },
            minViews: { type: 'integer', description: 'Minimum views filter' },
            disableEngagementFilter: {
              type: 'boolean',
              description: 'Disable engagement filter (when true, shows posts the user already clicked or saw in the feed)',
            },
          },
        },
        response: {
          200: { $ref: 'CustomFeed#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const con = ensureDbConnection(fastify.con);
      const {
        name,
        icon,
        orderBy,
        minDayRange,
        minUpvotes,
        minViews,
        disableEngagementFilter,
      } = request.body;

      return executeGraphql(
        con,
        {
          query: CREATE_FEED_MUTATION,
          variables: {
            name,
            icon: icon ?? null,
            orderBy: orderBy ?? null,
            minDayRange: minDayRange ?? null,
            minUpvotes: minUpvotes ?? null,
            minViews: minViews ?? null,
            disableEngagementFilter: disableEngagementFilter ?? null,
          },
        },
        (json) => {
          const result = json as unknown as CreateFeedResponse;
          return result.createFeed;
        },
        request,
        reply,
      );
    },
  );

  // List user's custom feeds
  fastify.get<{ Querystring: { limit?: string; cursor?: string } }>(
    '/',
    {
      schema: {
        description: "List user's custom feeds",
        tags: ['custom-feeds'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of feeds to return (1-50)',
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
              data: { type: 'array', items: { $ref: 'CustomFeed#' } },
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
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: FEED_LIST_QUERY,
          variables: {
            first: limit,
            after: cursor ?? null,
          },
        },
        (json) => {
          const result = json as unknown as FeedListResponse;
          return {
            data: result.feedList.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.feedList.pageInfo.hasNextPage,
              cursor: result.feedList.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get a specific custom feed's posts
  fastify.get<{
    Params: { feedId: string };
    Querystring: { limit?: string; cursor?: string };
  }>(
    '/:feedId',
    {
      schema: {
        description: "Get a custom feed's posts",
        tags: ['custom-feeds'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
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
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const { cursor } = request.query;
      const { feedId } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: CUSTOM_FEED_POSTS_QUERY,
          variables: {
            feedId,
            first: limit,
            after: cursor ?? null,
            ranking: 'POPULARITY',
            version: 1,
          },
        },
        (json) => {
          const result = json as unknown as CustomFeedPostsResponse;
          return {
            data: result.customFeed.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.customFeed.pageInfo.hasNextPage,
              cursor: result.customFeed.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get custom feed metadata
  fastify.get<{ Params: { feedId: string } }>(
    '/:feedId/info',
    {
      schema: {
        description: 'Get custom feed metadata',
        tags: ['custom-feeds'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        response: {
          200: { $ref: 'CustomFeed#' },
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
          query: GET_FEED_QUERY,
          variables: { feedId },
        },
        (json) => {
          const result = json as unknown as GetFeedResponse;
          if (!result.getFeed) {
            return reply.status(404).send({
              error: 'not_found',
              message: 'Feed not found',
            });
          }
          return result.getFeed;
        },
        request,
        reply,
      );
    },
  );

  // Update feed settings
  fastify.patch<{
    Params: { feedId: string };
    Body: {
      name: string;
      icon?: string;
      orderBy?: string;
      minDayRange?: number;
      minUpvotes?: number;
      minViews?: number;
      disableEngagementFilter?: boolean;
    };
  }>(
    '/:feedId',
    {
      schema: {
        description: 'Update custom feed settings',
        tags: ['custom-feeds'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', description: 'Name of the feed' },
            icon: { type: 'string', description: 'Icon emoji for the feed' },
            orderBy: {
              type: 'string',
              enum: ['DATE', 'UPVOTES', 'DOWNVOTES', 'COMMENTS', 'CLICKS'],
              description: 'Sort order for the feed (defaults to algorithmic ranking if not provided)',
            },
            minDayRange: {
              type: 'integer',
              description: 'Minimum day range filter',
            },
            minUpvotes: {
              type: 'integer',
              description: 'Minimum upvotes filter',
            },
            minViews: { type: 'integer', description: 'Minimum views filter' },
            disableEngagementFilter: {
              type: 'boolean',
              description: 'Disable engagement filter (when true, shows posts the user already clicked or saw in the feed)',
            },
          },
        },
        response: {
          200: { $ref: 'CustomFeed#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { feedId } = request.params;
      const {
        name,
        icon,
        orderBy,
        minDayRange,
        minUpvotes,
        minViews,
        disableEngagementFilter,
      } = request.body;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: UPDATE_FEED_MUTATION,
          variables: {
            feedId,
            name,
            icon: icon ?? null,
            orderBy: orderBy ?? null,
            minDayRange: minDayRange ?? null,
            minUpvotes: minUpvotes ?? null,
            minViews: minViews ?? null,
            disableEngagementFilter: disableEngagementFilter ?? null,
          },
        },
        (json) => {
          const result = json as unknown as UpdateFeedResponse;
          return result.updateFeed;
        },
        request,
        reply,
      );
    },
  );

  // Delete a custom feed
  fastify.delete<{ Params: { feedId: string } }>(
    '/:feedId',
    {
      schema: {
        description: 'Delete a custom feed',
        tags: ['custom-feeds'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
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
      const { feedId } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: DELETE_FEED_MUTATION,
          variables: { feedId },
        },
        () => ({ success: true }),
        request,
        reply,
      );
    },
  );

  // Update feed advanced settings
  fastify.patch<{
    Params: { feedId: string };
    Body: { settings: { id: number; enabled: boolean }[] };
  }>(
    '/:feedId/advanced',
    {
      schema: {
        description: 'Update custom feed advanced settings',
        tags: ['custom-feeds'],
        params: {
          type: 'object',
          properties: {
            feedId: { type: 'string', description: 'Feed ID' },
          },
          required: ['feedId'],
        },
        body: {
          type: 'object',
          required: ['settings'],
          properties: {
            settings: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'enabled'],
                properties: {
                  id: { type: 'integer', description: 'Setting ID' },
                  enabled: { type: 'boolean', description: 'Enabled state' },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: 'FeedAdvancedSettings#' },
              },
            },
          },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { feedId } = request.params;
      const { settings } = request.body;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: UPDATE_FEED_ADVANCED_SETTINGS_MUTATION,
          variables: {
            feedId,
            settings,
          },
        },
        (json) => {
          const result = json as unknown as UpdateFeedAdvancedSettingsResponse;
          return { data: result.updateFeedAdvancedSettings };
        },
        request,
        reply,
      );
    },
  );
}
