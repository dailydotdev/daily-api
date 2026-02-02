import { GraphQLError } from 'graphql';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface GraphqlPayload {
  query: string;
  operationName?: string;
  variables?: Record<string, unknown>;
}

export const injectGraphql = async (
  fastify: FastifyInstance,
  payload: GraphqlPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractResponse: (obj: Record<string, unknown>) => any,
  req: FastifyRequest,
  res: FastifyReply,
): Promise<FastifyReply> => {
  const reqHeaders = {
    ...req.headers,
  };
  delete reqHeaders['content-length'];
  const graphqlRes = await fastify.inject({
    method: 'POST',
    url: '/graphql',
    headers: reqHeaders,
    payload,
  });

  if (graphqlRes.statusCode !== 200) {
    req.log.warn(
      { graphqlResponse: graphqlRes.body },
      'unexpected status code when injecting graphql request',
    );
    return res.status(graphqlRes.statusCode).send(graphqlRes.rawPayload);
  }

  const json = await graphqlRes.json();
  const errors = json['errors'] as GraphQLError[];
  const code = errors?.[0]?.extensions?.code;
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
      message: errors?.[0]?.message || 'Invalid request',
    });
  }
  if (code === 'NOT_FOUND') {
    return res.status(404).send({
      error: 'not_found',
      message: errors?.[0]?.message || 'Resource not found',
    });
  }
  if (code || errors?.length) {
    req.log.warn(
      { graphqlResponse: json },
      'unexpected graphql error when injecting graphql request',
    );
    return res.status(500).send();
  }

  const resBody = extractResponse(json);
  return res.status(resBody ? 200 : 204).send(resBody);
};
