import type { FastifyInstance } from 'fastify';
import { injectGraphql } from '../../compatibility/utils';

interface FeedQuery {
  limit?: string;
  cursor?: string;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const FEED_QUERY = `
  query PublicApiFeed($first: Int, $after: String) {
    anonymousFeed(first: $first, after: $after, ranking: TIME, version: 1) {
      edges {
        node {
          id
          title
          url
          image
          publishedAt
          createdAt
          source {
            id
            name
            image
          }
          tags
          readTime
          numUpvotes
          numComments
          author {
            name
            image
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

interface FeedEdge {
  node: {
    id: string;
    title: string;
    url: string;
    image: string | null;
    publishedAt: string | null;
    createdAt: string;
    source: {
      id: string;
      name: string;
      image: string | null;
    };
    tags: string[];
    readTime: number | null;
    numUpvotes: number;
    numComments: number;
    author: {
      name: string;
      image: string | null;
    } | null;
  };
}

interface FeedResponse {
  data: {
    anonymousFeed: {
      edges: FeedEdge[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: FeedQuery }>(
    '/',
    {
      schema: {
        description: 'Get personalized feed of posts',
        tags: ['feed'],
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
      const userId = request.apiUserId;
      if (!userId) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'User not authenticated',
        });
      }

      const parsedLimit =
        parseInt(request.query.limit || '', 10) || DEFAULT_LIMIT;
      const limit = Math.min(Math.max(1, parsedLimit), MAX_LIMIT);
      const { cursor } = request.query;

      return injectGraphql(
        fastify,
        {
          query: FEED_QUERY,
          variables: {
            first: limit,
            after: cursor || null,
          },
        },
        (json) => {
          const feed = (json as unknown as FeedResponse).data.anonymousFeed;
          return {
            data: feed.edges.map(({ node }) => ({
              id: node.id,
              title: node.title,
              url: node.url,
              image: node.image,
              publishedAt: node.publishedAt,
              createdAt: node.createdAt,
              source: node.source,
              tags: node.tags || [],
              readTime: node.readTime,
              upvotes: node.numUpvotes,
              comments: node.numComments,
              author: node.author,
            })),
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
}
