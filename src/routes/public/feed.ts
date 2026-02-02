import type { FastifyInstance } from 'fastify';
import { injectGraphql } from '../../compatibility/utils';

interface FeedQuery {
  limit?: string;
  cursor?: string;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

// Using the personalized "For You" feed query for authenticated users
const FEED_QUERY = `
  query PublicApiFeed($first: Int, $after: String) {
    feed(first: $first, after: $after, ranking: TIME, version: 1) {
      edges {
        node {
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
            handle
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

interface FeedNode {
  id: string;
  title: string;
  url: string;
  image: string | null;
  summary: string | null;
  type: string;
  publishedAt: string | null;
  createdAt: string;
  commentsPermalink: string;
  source: {
    id: string;
    name: string;
    handle: string;
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
}

interface FeedResponse {
  data: {
    feed: {
      edges: { node: FeedNode }[];
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
      // Auth middleware already validates the user, apiUserId is guaranteed
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
          const feed = (json as unknown as FeedResponse).data.feed;
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
}
