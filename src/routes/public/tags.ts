import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import { ensureDbConnection } from './common';

const TAGS_QUERY = `
  query PublicApiTags {
    tags {
      value
    }
  }
`;

type TagsResponse = {
  tags: { value: string }[];
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get all tags',
        tags: ['tags'],
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'Tag#' } },
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
          query: TAGS_QUERY,
          variables: {},
        },
        (json) => ({
          data: (json as TagsResponse).tags.map(({ value }) => ({
            name: value,
          })),
        }),
        request,
        reply,
      );
    },
  );
}
