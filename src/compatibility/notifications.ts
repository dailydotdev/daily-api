import { FastifyInstance } from 'fastify';
import { Constants } from '@google-cloud/trace-agent/build/src/constants';
import { generateTraceContext } from '@google-cloud/trace-agent/build/src/util';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const traceContext = generateTraceContext(req.span.getTraceContext());
    const query = `{
  latestNotifications {
    timestamp
    html
  }
}`;
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
      .send(graphqlRes.json()['data']['latestNotifications']);
  });
}
