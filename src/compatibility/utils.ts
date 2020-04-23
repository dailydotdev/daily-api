import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ServerResponse } from 'http';
import { generateTraceContext } from '@google-cloud/trace-agent/build/src/util';
import { Constants } from '@google-cloud/trace-agent/build/src/constants';

export const injectGraphqlQuery = async (
  fastify: FastifyInstance,
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractResponse: (obj: object) => any,
  req: FastifyRequest,
  res: FastifyReply<ServerResponse>,
): Promise<FastifyReply<ServerResponse>> => {
  const traceContext = generateTraceContext(req.span.getTraceContext());
  const graphqlRes = await fastify.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      ...req.headers,
      [Constants.TRACE_CONTEXT_HEADER_NAME]: traceContext,
    },
    payload: { query },
  });

  if (graphqlRes.statusCode !== 200) {
    return res.status(graphqlRes.statusCode).send(graphqlRes.rawPayload);
  }

  const resHeaders = { ...graphqlRes.headers };
  delete resHeaders['content-length'];
  return res
    .status(200)
    .headers(resHeaders)
    .send(extractResponse(graphqlRes.json()));
};
