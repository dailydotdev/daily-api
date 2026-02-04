import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import { ensureDbConnection, TOOL_FIELDS, ToolType } from './common';

// GraphQL queries
const AUTOCOMPLETE_TOOLS_QUERY = `
  query PublicApiAutocompleteTools($query: String!) {
    autocompleteTools(query: $query) {
      ${TOOL_FIELDS}
    }
  }
`;

// Response types
interface AutocompleteToolsResponse {
  autocompleteTools: ToolType[];
}

export default async function (fastify: FastifyInstance): Promise<void> {
  // Search for tools/technologies
  fastify.get<{ Querystring: { query: string } }>(
    '/search',
    {
      schema: {
        description: 'Search for tools/technologies by name',
        tags: ['tools'],
        querystring: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 1,
              description: 'Search query (minimum 1 character)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'Tool#' } },
            },
          },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { query } = request.query;
      const con = ensureDbConnection(fastify.con);

      if (!query || query.length < 1) {
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Query must be at least 1 character',
        });
      }

      return executeGraphql(
        con,
        {
          query: AUTOCOMPLETE_TOOLS_QUERY,
          variables: { query },
        },
        (json) => {
          const result = json as unknown as AutocompleteToolsResponse;
          return { data: result.autocompleteTools };
        },
        request,
        reply,
      );
    },
  );
}
