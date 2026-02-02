import type { FastifyInstance } from 'fastify';
import { injectGraphql } from '../../compatibility/utils';

interface PostParams {
  id: string;
}

const POST_QUERY = `
  query PublicApiPost($id: ID!) {
    post(id: $id) {
      id
      title
      url
      image
      summary
      publishedAt
      createdAt
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
      publishedAt: string | null;
      createdAt: string;
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

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: PostParams }>(
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
      const userId = request.apiUserId;
      if (!userId) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'User not authenticated',
        });
      }

      const { id } = request.params;

      return injectGraphql(
        fastify,
        {
          query: POST_QUERY,
          variables: { id },
        },
        (json) => {
          const { post } = (json as unknown as PostQueryResponse).data;
          const sourceUrl = post.source.handle
            ? `https://app.daily.dev/sources/${post.source.handle}`
            : null;

          return {
            data: {
              id: post.id,
              title: post.title,
              url: post.url,
              image: post.image,
              summary: post.summary,
              publishedAt: post.publishedAt,
              createdAt: post.createdAt,
              source: {
                id: post.source.id,
                name: post.source.name,
                image: post.source.image,
                url: sourceUrl,
              },
              author: post.author,
              tags: post.tags || [],
              readTime: post.readTime,
              upvotes: post.numUpvotes,
              comments: post.numComments,
              bookmarked: post.bookmarked,
              userState: post.userState,
            },
          };
        },
        request,
        reply,
      );
    },
  );
}
