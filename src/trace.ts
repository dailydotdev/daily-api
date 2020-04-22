import {
  FastifyInstance,
  FastifyRequest,
  DefaultQuery,
  DefaultParams,
  DefaultHeaders,
} from 'fastify';
import * as fp from 'fastify-plugin';
import * as traceAgent from '@google-cloud/trace-agent';

declare module 'fastify' {
  interface FastifyRequest<
    HttpRequest,
    Query = DefaultQuery,
    Params = DefaultParams,
    Headers = DefaultHeaders,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Body = any
  > {
    span: traceAgent.PluginTypes.Span;
  }
}

const plugin = async (
  fastify: FastifyInstance,
  opts: traceAgent.Config,
): Promise<void> => {
  const tracer = traceAgent.start(opts);
  fastify.decorateRequest('span', null);
  fastify.addHook('onRequest', async (req) => {
    tracer.runInRootSpan({ name: req.raw.url }, (span) => {
      span.addLabel('/http/method', req.raw.method);
      span.addLabel('/http/id', req.id);
      span.addLabel('/http/source/ip', req.ip);
      req.span = span;
    });
  });
  fastify.addHook('onResponse', async (req, res) => {
    req.span.addLabel('/http/status_code', res.res.statusCode);
    req.span.endSpan();
  });
};

export default fp(plugin, {
  name: 'trace-agent',
});
