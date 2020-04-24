import { GraphQLError } from 'graphql';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ServerResponse } from 'http';
import { generateTraceContext } from '@google-cloud/trace-agent/build/src/util';
import { Constants } from '@google-cloud/trace-agent/build/src/constants';

interface GraphqlPayload {
  query: string;
  operationName?: string;
  variables?: object;
}

export const injectGraphql = async (
  fastify: FastifyInstance,
  payload: GraphqlPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractResponse: (obj: object) => any,
  req: FastifyRequest,
  res: FastifyReply<ServerResponse>,
): Promise<FastifyReply<ServerResponse>> => {
  const traceContext = generateTraceContext(req.span.getTraceContext());
  const reqHeaders = {
    ...req.headers,
    [Constants.TRACE_CONTEXT_HEADER_NAME]: traceContext,
  };
  delete reqHeaders['content-length'];
  const graphqlRes = await fastify.inject({
    method: 'POST',
    url: '/graphql',
    headers: reqHeaders,
    payload,
  });

  if (graphqlRes.statusCode !== 200) {
    return res.status(graphqlRes.statusCode).send(graphqlRes.rawPayload);
  }

  const json = graphqlRes.json();
  const errors = json['errors'] as GraphQLError[];
  const code = errors?.[0]?.extensions?.code;
  if (code === 'UNAUTHORIZED_ERROR') {
    return res.status(401).send();
  } else if (code === 'VALIDATION_ERROR') {
    return res.status(400).send();
  } else if (code) {
    return res.status(500).send();
  }

  const resBody = extractResponse(json);
  const resHeaders = { ...graphqlRes.headers };
  delete resHeaders['content-length'];
  return res
    .status(resBody ? 200 : 204)
    .headers(resHeaders)
    .send(resBody);
};
