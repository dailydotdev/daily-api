import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import { parseLimit, ensureDbConnection } from './common';

// GraphQL query for post comments
const POST_COMMENTS_QUERY = `
  query PublicApiPostComments($postId: ID!, $first: Int, $after: String, $sortBy: SortCommentsBy) {
    postComments(postId: $postId, first: $first, after: $after, sortBy: $sortBy) {
      edges {
        node {
          id
          content
          contentHtml
          createdAt
          lastUpdatedAt
          permalink
          numUpvotes
          author {
            id
            name
            username
            image
          }
          children {
            edges {
              node {
                id
                content
                contentHtml
                createdAt
                permalink
                numUpvotes
                author {
                  id
                  name
                  username
                  image
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const POST_QUERY = `
  query PublicApiPost($id: ID!) {
    post(id: $id) {
      id
      title
      url
      image
      summary
      type
      publishedAt
      createdAt
      commentsPermalink
      source {
        id
        name
        image
        handle
      }
      author {
        id
        name
        image
        username
      }
      tags
      readTime
      numUpvotes
      numComments
      bookmarked
      userState {
        vote
      }
    }
  }
`;

interface PostQueryResponse {
  data: {
    post: {
      id: string;
      title: string;
      url: string | null;
      image: string | null;
      summary: string | null;
      type: string;
      publishedAt: string | null;
      createdAt: string;
      commentsPermalink: string;
      source: {
        id: string;
        name: string;
        image: string | null;
        handle: string | null;
      };
      author: {
        id: string;
        name: string;
        image: string | null;
        username: string | null;
      } | null;
      tags: string[];
      readTime: number | null;
      numUpvotes: number;
      numComments: number;
      bookmarked: boolean;
      userState: {
        vote: number;
      } | null;
    };
  };
}

interface CommentAuthor {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

interface CommentNode {
  id: string;
  content: string;
  contentHtml: string;
  createdAt: string;
  lastUpdatedAt?: string | null;
  permalink: string;
  numUpvotes: number;
  author: CommentAuthor;
  children?: {
    edges: { node: Omit<CommentNode, 'children' | 'lastUpdatedAt'> }[];
  };
}

interface PostCommentsResponse {
  postComments: {
    edges: { node: CommentNode }[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        description: 'Get post details by ID',
        tags: ['posts'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Post ID' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { $ref: 'PostDetail#' },
            },
          },
          401: { $ref: 'Error#' },
          403: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: POST_QUERY,
          variables: { id },
        },
        (json) => {
          const { post } = json as PostQueryResponse['data'];
          return { data: post };
        },
        request,
        reply,
      );
    },
  );

  // Get comments for a post
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; cursor?: string; sort?: string };
  }>(
    '/:id/comments',
    {
      schema: {
        description: 'Get comments for a post',
        tags: ['posts'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Post ID' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of comments to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
            sort: {
              type: 'string',
              enum: ['oldest', 'newest'],
              default: 'oldest',
              description: 'Sort order (oldest or newest first)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'Comment#' } },
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
      const { id } = request.params;
      const limit = parseLimit(request.query.limit);
      const { cursor, sort } = request.query;
      const con = ensureDbConnection(fastify.con);

      // Sort values are already in the correct format (lowercase)
      const sortBy = sort ?? 'oldest';

      return executeGraphql(
        con,
        {
          query: POST_COMMENTS_QUERY,
          variables: {
            postId: id,
            first: limit,
            after: cursor ?? null,
            sortBy,
          },
        },
        (json) => {
          const result = json as unknown as PostCommentsResponse;
          // Transform nested children structure to flat children array
          const transformComment = (node: CommentNode) => ({
            ...node,
            children:
              node.children?.edges.map(({ node: child }) => child) ?? [],
          });
          return {
            data: result.postComments.edges.map(({ node }) =>
              transformComment(node),
            ),
            pagination: {
              hasNextPage: result.postComments.pageInfo.hasNextPage,
              cursor: result.postComments.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );
}
