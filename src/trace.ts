import * as http from 'http';
import { ServerResponse } from 'http';
import {
  FastifyInstance,
  FastifyRequest,
  DefaultQuery,
  DefaultParams,
  DefaultHeaders,
  FastifyReply,
} from 'fastify';
import * as fp from 'fastify-plugin';
import * as traceAgent from '@google-cloud/trace-agent';
import {
  parseContextFromHeader,
  TraceContext,
} from '@google-cloud/trace-agent/build/src/util';
import { Constants } from '@google-cloud/trace-agent/build/src/constants';

declare module 'fastify' {
  interface FastifyRequest<
    HttpRequest,
    Query = DefaultQuery,
    Params = DefaultParams,
    Headers = DefaultHeaders,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Body = any
  > {
    span: traceAgent.PluginTypes.RootSpan;
  }

  interface FastifyInstance<
    HttpServer = http.Server,
    HttpRequest = http.IncomingMessage,
    HttpResponse = http.ServerResponse
  > {
    tracer: traceAgent.PluginTypes.Tracer;
  }
}

const getTraceContext = (req: FastifyRequest): TraceContext | null =>
  parseContextFromHeader(req.headers[Constants.TRACE_CONTEXT_HEADER_NAME]);

const addSpanLabels = (
  span: traceAgent.PluginTypes.Span,
  req: FastifyRequest,
  res: FastifyReply<ServerResponse>,
): void => {
  span.addLabel('/http/method', req.raw.method);
  span.addLabel('/http/id', req.id);
  span.addLabel('/http/source/ip', req.ip);
  span.addLabel('/http/status_code', res.res.statusCode);
};

const createSpan = (
  tracer: traceAgent.PluginTypes.Tracer,
  name: string,
  traceContext: TraceContext | null,
): Promise<traceAgent.PluginTypes.RootSpan> => {
  return new Promise<traceAgent.PluginTypes.RootSpan>((resolve) => {
    tracer.runInRootSpan({ name, traceContext }, resolve);
  });
};

const plugin = async (
  fastify: FastifyInstance,
  opts: traceAgent.Config,
): Promise<void> => {
  const tracer = traceAgent.start(opts);
  fastify.decorate('tracer', tracer);
  fastify.decorateRequest('span', null);
  fastify.addHook('onRequest', async (req) => {
    const traceContext = getTraceContext(req);
    req.span = await createSpan(tracer, req.raw.url, traceContext);
  });
  fastify.addHook('onResponse', async (req, res) => {
    addSpanLabels(req.span, req, res);
    req.span.endSpan();
  });
};

export default fp(plugin, {
  name: 'trace-agent',
});
