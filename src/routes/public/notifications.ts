import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import {
  parseLimit,
  ensureDbConnection,
  NOTIFICATION_FIELDS,
  PAGE_INFO_FIELDS,
  NotificationConnection,
} from './common';

// GraphQL queries
const NOTIFICATIONS_QUERY = `
  query PublicApiNotifications($first: Int, $after: String) {
    notifications(first: $first, after: $after) {
      edges {
        node {
          ${NOTIFICATION_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

const UNREAD_NOTIFICATIONS_COUNT_QUERY = `
  query PublicApiUnreadNotificationsCount {
    unreadNotificationsCount
  }
`;

// GraphQL mutations
const READ_NOTIFICATIONS_MUTATION = `
  mutation PublicApiReadNotifications {
    readNotifications {
      _
    }
  }
`;

// Response types
interface NotificationsResponse {
  notifications: NotificationConnection;
}

interface UnreadNotificationsCountResponse {
  unreadNotificationsCount: number;
}

export default async function (fastify: FastifyInstance): Promise<void> {
  // Get user notifications
  fastify.get<{ Querystring: { limit?: string; cursor?: string } }>(
    '/',
    {
      schema: {
        description: 'Get user notifications',
        tags: ['notifications'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of notifications to return (1-50)',
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
              data: { type: 'array', items: { $ref: 'Notification#' } },
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
          query: NOTIFICATIONS_QUERY,
          variables: {
            first: limit,
            after: cursor ?? null,
          },
        },
        (json) => {
          const result = json as unknown as NotificationsResponse;
          return {
            data: result.notifications.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.notifications.pageInfo.hasNextPage,
              cursor: result.notifications.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get unread notifications count
  fastify.get(
    '/unread/count',
    {
      schema: {
        description: 'Get unread notifications count',
        tags: ['notifications'],
        response: {
          200: { $ref: 'UnreadCount#' },
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
          query: UNREAD_NOTIFICATIONS_COUNT_QUERY,
          variables: {},
        },
        (json) => {
          const result = json as unknown as UnreadNotificationsCountResponse;
          return { count: result.unreadNotificationsCount };
        },
        request,
        reply,
      );
    },
  );

  // Mark all notifications as read
  fastify.post(
    '/read',
    {
      schema: {
        description: 'Mark all notifications as read',
        tags: ['notifications'],
        response: {
          200: { $ref: 'SuccessResponse#' },
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
          query: READ_NOTIFICATIONS_MUTATION,
          variables: {},
        },
        () => ({ success: true }),
        request,
        reply,
      );
    },
  );
}
