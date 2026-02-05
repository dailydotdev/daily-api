import { execute, parse, DocumentNode, GraphQLError } from 'graphql';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DataSource } from 'typeorm';
import { Context } from '../../Context';
import { schema } from '../../graphql';

export interface GraphqlPayload {
  query: string;
  operationName?: string;
  variables?: Record<string, unknown>;
}

// Cache for parsed queries to avoid re-parsing
const queryCache = new Map<string, DocumentNode>();

const parseQuery = (query: string): DocumentNode => {
  const cached = queryCache.get(query);
  if (cached) {
    return cached;
  }
  const document = parse(query);
  queryCache.set(query, document);
  return document;
};

/**
 * Execute GraphQL directly without HTTP injection.
 * Uses the real FastifyRequest (already authenticated by PAT hook) to create the Context.
 * This eliminates the need for HMAC tokens and fastify.inject().
 */
export const executeGraphql = async <T>(
  con: DataSource,
  payload: GraphqlPayload,
  extractResponse: (obj: Record<string, unknown>) => T | Promise<T>,
  req: FastifyRequest,
  res: FastifyReply,
): Promise<FastifyReply> => {
  // Create context from the REAL request (already has userId, isPlus from PAT auth hook)
  const context = new Context(req, con);

  // Parse the query (with caching for performance)
  const document = parseQuery(payload.query);

  // Execute GraphQL directly - no HTTP injection
  const result = await execute({
    schema,
    document,
    contextValue: context,
    variableValues: payload.variables,
    operationName: payload.operationName,
  });

  // Map GraphQL errors to HTTP status codes (same logic as injectGraphql)
  if (result.errors?.length) {
    const errors = result.errors as GraphQLError[];
    const code = errors[0]?.extensions?.code;
    const originalErrorName = errors[0]?.originalError?.name;

    if (code === 'UNAUTHENTICATED') {
      return res.status(401).send({
        error: 'unauthorized',
        message: 'Authentication required',
      });
    }
    if (code === 'FORBIDDEN') {
      return res.status(403).send({
        error: 'forbidden',
        message: 'Access denied',
      });
    }
    if (code === 'VALIDATION_ERROR' || code === 'GRAPHQL_VALIDATION_FAILED') {
      return res.status(400).send({
        error: 'validation_error',
        message: errors[0]?.message || 'Invalid request',
      });
    }
    if (code === 'NOT_FOUND' || originalErrorName === 'EntityNotFoundError') {
      return res.status(404).send({
        error: 'not_found',
        message: errors[0]?.message || 'Resource not found',
      });
    }

    // Unexpected errors
    req.log.warn(
      { graphqlResponse: result },
      'unexpected graphql error when executing graphql request',
    );
    return res.status(500).send();
  }

  const resBody = await extractResponse(result.data as Record<string, unknown>);
  // If extractResponse already sent a response (e.g., 404), don't send again
  if (res.sent) {
    return res;
  }
  return res.status(resBody ? 200 : 204).send(resBody);
};
