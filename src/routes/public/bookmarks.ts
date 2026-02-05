import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import {
  parseLimit,
  ensureDbConnection,
  POST_NODE_FIELDS,
  BOOKMARKED_POST_EXTRA_FIELDS,
  PAGE_INFO_FIELDS,
  FeedConnection,
  BookmarkedPostNode,
} from './common';

// GraphQL query for bookmarks feed
const BOOKMARKS_FEED_QUERY = `
  query PublicApiBookmarksFeed($first: Int, $after: String, $unreadOnly: Boolean, $listId: ID) {
    bookmarksFeed(first: $first, after: $after, unreadOnly: $unreadOnly, listId: $listId) {
      edges {
        node {
          ${POST_NODE_FIELDS}
          ${BOOKMARKED_POST_EXTRA_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL query for searching bookmarks
const SEARCH_BOOKMARKS_QUERY = `
  query PublicApiSearchBookmarks($query: String!, $first: Int, $after: String, $unreadOnly: Boolean, $listId: ID) {
    searchBookmarks(query: $query, first: $first, after: $after, unreadOnly: $unreadOnly, listId: $listId) {
      edges {
        node {
          ${POST_NODE_FIELDS}
          ${BOOKMARKED_POST_EXTRA_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// GraphQL query for bookmark lists
const BOOKMARK_LISTS_QUERY = `
  query PublicApiBookmarkLists {
    bookmarkLists {
      id
      name
      icon
      createdAt
    }
  }
`;

// GraphQL mutation for creating bookmark list
const CREATE_BOOKMARK_LIST_MUTATION = `
  mutation PublicApiCreateBookmarkList($name: String!, $icon: String) {
    createBookmarkList(name: $name, icon: $icon) {
      id
      name
      icon
      createdAt
    }
  }
`;

// GraphQL mutation for removing bookmark list
const REMOVE_BOOKMARK_LIST_MUTATION = `
  mutation PublicApiRemoveBookmarkList($id: ID!) {
    removeBookmarkList(id: $id) {
      _
    }
  }
`;

// GraphQL mutation for adding bookmarks
const ADD_BOOKMARKS_MUTATION = `
  mutation PublicApiAddBookmarks($data: AddBookmarkInput!) {
    addBookmarks(data: $data) {
      postId
      createdAt
      list {
        id
        name
      }
    }
  }
`;

// GraphQL mutation for removing bookmark
const REMOVE_BOOKMARK_MUTATION = `
  mutation PublicApiRemoveBookmark($id: ID!) {
    removeBookmark(id: $id) {
      _
    }
  }
`;

interface BookmarksFeedResponse {
  bookmarksFeed: FeedConnection<BookmarkedPostNode>;
}

interface SearchBookmarksResponse {
  searchBookmarks: FeedConnection<BookmarkedPostNode>;
}

interface BookmarkList {
  id: string;
  name: string;
  icon: string | null;
  createdAt: string;
}

interface BookmarkListsResponse {
  bookmarkLists: BookmarkList[];
}

interface CreateBookmarkListResponse {
  createBookmarkList: BookmarkList;
}

interface AddBookmarksResponse {
  addBookmarks: {
    postId: string;
    createdAt: string;
    list: { id: string; name: string } | null;
  }[];
}

export default async function (fastify: FastifyInstance): Promise<void> {
  // Get bookmarks feed
  fastify.get<{
    Querystring: {
      limit?: string;
      cursor?: string;
      unreadOnly?: string;
      listId?: string;
    };
  }>(
    '/',
    {
      schema: {
        description: "Get user's bookmarked posts",
        tags: ['bookmarks'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of bookmarks to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
            unreadOnly: {
              type: 'boolean',
              default: false,
              description: 'Filter to unread bookmarks only',
            },
            listId: {
              type: 'string',
              description: 'Filter by bookmark list ID',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'BookmarkedPost#' } },
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
      const { cursor, listId } = request.query;
      const unreadOnly = request.query.unreadOnly === 'true';
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: BOOKMARKS_FEED_QUERY,
          variables: {
            first: limit,
            after: cursor ?? null,
            unreadOnly: unreadOnly ? true : null,
            listId: listId ?? null,
          },
        },
        (json) => {
          const result = json as unknown as BookmarksFeedResponse;
          return {
            data: result.bookmarksFeed.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.bookmarksFeed.pageInfo.hasNextPage,
              cursor: result.bookmarksFeed.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Search bookmarks
  fastify.get<{
    Querystring: {
      q: string;
      limit?: string;
      cursor?: string;
      unreadOnly?: string;
      listId?: string;
    };
  }>(
    '/search',
    {
      schema: {
        description: 'Search within bookmarks',
        tags: ['bookmarks'],
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
              description: 'Number of results to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
            unreadOnly: {
              type: 'boolean',
              default: false,
              description: 'Filter to unread bookmarks only',
            },
            listId: {
              type: 'string',
              description: 'Filter by bookmark list ID',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'BookmarkedPost#' } },
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
      const { q, listId } = request.query;
      const limit = parseLimit(request.query.limit);
      const { cursor } = request.query;
      const unreadOnly = request.query.unreadOnly === 'true';
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: SEARCH_BOOKMARKS_QUERY,
          variables: {
            query: q,
            first: limit,
            after: cursor ?? null,
            unreadOnly: unreadOnly ? true : null,
            listId: listId ?? null,
          },
        },
        (json) => {
          const result = json as unknown as SearchBookmarksResponse;
          return {
            data: result.searchBookmarks.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.searchBookmarks.pageInfo.hasNextPage,
              cursor: result.searchBookmarks.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get bookmark lists
  fastify.get(
    '/lists',
    {
      schema: {
        description: "Get user's bookmark lists",
        tags: ['bookmarks'],
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'BookmarkList#' } },
            },
          },
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
          query: BOOKMARK_LISTS_QUERY,
          variables: {},
        },
        (json) => {
          const result = json as unknown as BookmarkListsResponse;
          return {
            data: result.bookmarkLists,
          };
        },
        request,
        reply,
      );
    },
  );

  // Create bookmark list
  fastify.post<{ Body: { name: string; icon?: string } }>(
    '/lists',
    {
      schema: {
        description: 'Create a new bookmark list',
        tags: ['bookmarks'],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              description: 'Name of the bookmark list',
              minLength: 1,
              maxLength: 100,
            },
            icon: {
              type: 'string',
              description: 'Icon emoji for the list',
              maxLength: 10,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { $ref: 'BookmarkList#' },
            },
          },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { name, icon } = request.body;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: CREATE_BOOKMARK_LIST_MUTATION,
          variables: { name, icon: icon ?? null },
        },
        (json) => {
          const result = json as unknown as CreateBookmarkListResponse;
          return {
            data: result.createBookmarkList,
          };
        },
        request,
        reply,
      );
    },
  );

  // Delete bookmark list
  fastify.delete<{ Params: { id: string } }>(
    '/lists/:id',
    {
      schema: {
        description: 'Delete a bookmark list',
        tags: ['bookmarks'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Bookmark list ID' },
          },
          required: ['id'],
        },
        response: {
          204: {
            description: 'Bookmark list deleted successfully',
            type: 'null',
          },
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
          query: REMOVE_BOOKMARK_LIST_MUTATION,
          variables: { id },
        },
        () => null,
        request,
        reply,
      );
    },
  );

  // Add bookmarks
  fastify.post<{ Body: { postIds: string[]; listId?: string } }>(
    '/',
    {
      schema: {
        description: 'Add posts to bookmarks',
        tags: ['bookmarks'],
        body: {
          type: 'object',
          required: ['postIds'],
          properties: {
            postIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 100,
              description: 'Array of post IDs to bookmark (1-100)',
            },
            listId: {
              type: 'string',
              description:
                'Optional bookmark list ID to add bookmarks to (Plus feature)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    postId: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    list: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          403: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { postIds, listId } = request.body;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: ADD_BOOKMARKS_MUTATION,
          variables: { data: { postIds, listId: listId ?? null } },
        },
        (json) => {
          const result = json as unknown as AddBookmarksResponse;
          return {
            data: result.addBookmarks,
          };
        },
        request,
        reply,
      );
    },
  );

  // Remove bookmark
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        description: 'Remove a post from bookmarks',
        tags: ['bookmarks'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Post ID to unbookmark' },
          },
          required: ['id'],
        },
        response: {
          204: {
            description: 'Bookmark removed successfully',
            type: 'null',
          },
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
          query: REMOVE_BOOKMARK_MUTATION,
          variables: { id },
        },
        () => null,
        request,
        reply,
      );
    },
  );
}
