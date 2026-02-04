import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import {
  parseLimit,
  ensureDbConnection,
  STACK_ITEM_FIELDS,
  PAGE_INFO_FIELDS,
  StackItemType,
  StackConnection,
} from './common';

// GraphQL queries
const USER_STACK_QUERY = `
  query PublicApiUserStack($userId: ID!, $first: Int, $after: String) {
    userStack(userId: $userId, first: $first, after: $after) {
      edges {
        node {
          ${STACK_ITEM_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL mutations
const ADD_USER_STACK_MUTATION = `
  mutation PublicApiAddUserStack($input: AddUserStackInput!) {
    addUserStack(input: $input) {
      ${STACK_ITEM_FIELDS}
    }
  }
`;

const UPDATE_USER_STACK_MUTATION = `
  mutation PublicApiUpdateUserStack($id: ID!, $input: UpdateUserStackInput!) {
    updateUserStack(id: $id, input: $input) {
      ${STACK_ITEM_FIELDS}
    }
  }
`;

const DELETE_USER_STACK_MUTATION = `
  mutation PublicApiDeleteUserStack($id: ID!) {
    deleteUserStack(id: $id) {
      _
    }
  }
`;

const REORDER_USER_STACK_MUTATION = `
  mutation PublicApiReorderUserStack($items: [ReorderUserStackInput!]!) {
    reorderUserStack(items: $items) {
      ${STACK_ITEM_FIELDS}
    }
  }
`;

// Response types
interface UserStackResponse {
  userStack: StackConnection;
}

interface AddUserStackResponse {
  addUserStack: StackItemType;
}

interface UpdateUserStackResponse {
  updateUserStack: StackItemType;
}

interface ReorderUserStackResponse {
  reorderUserStack: StackItemType[];
}

export default async function (fastify: FastifyInstance): Promise<void> {
  // Get user's tech stack
  fastify.get<{ Querystring: { limit?: string; cursor?: string } }>(
    '/',
    {
      schema: {
        description: "Get current user's tech stack",
        tags: ['stack'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of items to return (1-50)',
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
              data: { type: 'array', items: { $ref: 'StackItem#' } },
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
      const userId = request.userId;

      if (!userId) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Authentication required',
        });
      }

      return executeGraphql(
        con,
        {
          query: USER_STACK_QUERY,
          variables: {
            userId,
            first: limit,
            after: cursor ?? null,
          },
        },
        (json) => {
          const result = json as unknown as UserStackResponse;
          return {
            data: result.userStack.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.userStack.pageInfo.hasNextPage,
              cursor: result.userStack.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Add tool to stack
  fastify.post<{
    Body: {
      title: string;
      section: string;
      startedAt?: string;
    };
  }>(
    '/',
    {
      schema: {
        description: 'Add a tool to user stack',
        tags: ['stack'],
        body: {
          type: 'object',
          required: ['title', 'section'],
          properties: {
            title: {
              type: 'string',
              description: 'Tool title (must match an existing tool)',
            },
            section: {
              type: 'string',
              description:
                'Stack section (primary, hobby, learning, past, custom)',
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When the user started using this tool',
            },
          },
        },
        response: {
          200: { $ref: 'StackItem#' },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const con = ensureDbConnection(fastify.con);
      const { title, section, startedAt } = request.body;

      // Only include startedAt if provided (Zod schema expects undefined, not null)
      const input: { title: string; section: string; startedAt?: string } = {
        title,
        section,
      };
      if (startedAt) {
        input.startedAt = startedAt;
      }

      return executeGraphql(
        con,
        {
          query: ADD_USER_STACK_MUTATION,
          variables: { input },
        },
        (json) => {
          const result = json as unknown as AddUserStackResponse;
          return result.addUserStack;
        },
        request,
        reply,
      );
    },
  );

  // Update stack item
  fastify.patch<{
    Params: { id: string };
    Body: {
      section?: string;
      icon?: string;
      title?: string;
      startedAt?: string;
    };
  }>(
    '/:id',
    {
      schema: {
        description: 'Update a stack item',
        tags: ['stack'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Stack item ID' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              description:
                'Stack section (primary, hobby, learning, past, custom)',
            },
            icon: {
              type: 'string',
              description: 'Custom icon emoji',
            },
            title: {
              type: 'string',
              description: 'Custom title override',
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When the user started using this tool',
            },
          },
        },
        response: {
          200: { $ref: 'StackItem#' },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { section, icon, title, startedAt } = request.body;
      const con = ensureDbConnection(fastify.con);

      // Build the input object, only including defined values
      const input: Record<string, unknown> = {};
      if (section !== undefined) input.section = section;
      if (icon !== undefined) input.icon = icon;
      if (title !== undefined) input.title = title;
      if (startedAt !== undefined) input.startedAt = startedAt;

      return executeGraphql(
        con,
        {
          query: UPDATE_USER_STACK_MUTATION,
          variables: { id, input },
        },
        (json) => {
          const result = json as unknown as UpdateUserStackResponse;
          return result.updateUserStack;
        },
        request,
        reply,
      );
    },
  );

  // Delete stack item
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        description: 'Remove a tool from user stack',
        tags: ['stack'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Stack item ID' },
          },
          required: ['id'],
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
      const { id } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: DELETE_USER_STACK_MUTATION,
          variables: { id },
        },
        () => ({ success: true }),
        request,
        reply,
      );
    },
  );

  // Reorder stack items
  fastify.put<{
    Body: { items: Array<{ id: string; position: number }> };
  }>(
    '/reorder',
    {
      schema: {
        description: 'Reorder stack items',
        tags: ['stack'],
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'position'],
                properties: {
                  id: { type: 'string', description: 'Stack item ID' },
                  position: {
                    type: 'integer',
                    minimum: 0,
                    description: 'New position',
                  },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'StackItem#' } },
            },
          },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { items } = request.body;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: REORDER_USER_STACK_MUTATION,
          variables: { items },
        },
        (json) => {
          const result = json as unknown as ReorderUserStackResponse;
          return { data: result.reorderUserStack };
        },
        request,
        reply,
      );
    },
  );
}
