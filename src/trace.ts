// import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// import fp from 'fastify-plugin';
// import * as traceAgent from '@google-cloud/trace-agent';
// import {
//   parseContextFromHeader,
//   TraceContext,
// } from '@google-cloud/trace-agent/build/src/util';
// import { Constants } from '@google-cloud/trace-agent/build/src/constants';

// declare module 'fastify' {
//   /* eslint-disable @typescript-eslint/no-unused-vars */
//   interface FastifyRequest {
//     span: traceAgent.PluginTypes.RootSpan;
//   }

//   interface FastifyInstance {
//     tracer: traceAgent.PluginTypes.Tracer;
//   }

//   /* eslint-enable @typescript-eslint/no-unused-vars */
// }

// const getTraceContext = (req: FastifyRequest): TraceContext | null =>
//   parseContextFromHeader(
//     req.headers[Constants.TRACE_CONTEXT_HEADER_NAME] as string,
//   );

// const addSpanLabels = (
//   span: traceAgent.PluginTypes.Span,
//   req: FastifyRequest,
//   res: FastifyReply,
// ): void => {
//   span.addLabel('/http/method', req.raw.method);
//   span.addLabel('/http/id', req.id);
//   span.addLabel('/http/source/ip', req.ip);
//   span.addLabel('/http/status_code', res.statusCode);
// };

// const createSpan = (
//   tracer: traceAgent.PluginTypes.Tracer,
//   name: string,
//   traceContext: TraceContext | null,
// ): Promise<traceAgent.PluginTypes.RootSpan> => {
//   return new Promise<traceAgent.PluginTypes.RootSpan>((resolve) => {
//     tracer.runInRootSpan({ name, traceContext }, resolve);
//   });
// };

// export const runInSpan = async <T>(
//   rootSpan: traceAgent.PluginTypes.RootSpan | undefined,
//   name: string,
//   func: () => Promise<T>,
//   labels?: Record<string, unknown>,
// ): Promise<T> => {
//   if (!rootSpan) {
//     return func();
//   }
//   const childSpan = rootSpan.createChildSpan({ name });
//   if (labels) {
//     Object.keys(labels).forEach((key) => childSpan.addLabel(key, labels[key]));
//   }
//   try {
//     const res = await func();
//     childSpan.endSpan();
//     return res;
//   } catch (err) {
//     childSpan.addLabel('error', err?.name);
//     childSpan.endSpan();
//     throw err;
//   }
// };

// const plugin = async (
//   fastify: FastifyInstance,
//   opts: traceAgent.Config,
// ): Promise<void> => {
//   const tracer = traceAgent.start(opts);
//   fastify.decorate('tracer', tracer);
//   fastify.decorateRequest('span', null);
//   fastify.addHook('onRequest', async (req) => {
//     const traceContext = getTraceContext(req);
//     req.span = await createSpan(tracer, req.raw.url, traceContext);
//   });
//   fastify.addHook('onResponse', async (req, res) => {
//     addSpanLabels(req.span, req, res);
//     req.span.endSpan();
//   });
// };

// export default fp(plugin, {
//   name: 'trace-agent',
// });
