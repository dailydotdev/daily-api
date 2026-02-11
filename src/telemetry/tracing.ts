import type { FastifyInstance } from 'fastify';
import type { Message } from '@google-cloud/pubsub';

import FastifyOtelInstrumentation from '@fastify/otel';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { TypeormInstrumentation } from 'opentelemetry-instrumentation-typeorm';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

import dc from 'node:diagnostics_channel';

import { node, api } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

import {
  type AppVersionRequest,
  channelName,
  getAppVersion,
  SEMATTRS_DAILY_APPS_USER_ID,
  SEMATTRS_DAILY_APPS_VERSION,
  SEMATTRS_DAILY_STAFF,
} from './common';
import {
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_MESSAGE_BODY_SIZE,
  ATTR_MESSAGING_MESSAGE_ID,
  ATTR_MESSAGING_SYSTEM,
  // @ts-expect-error - no longer resolves types because of cjs/esm change but values are exported
} from '@opentelemetry/semantic-conventions/incubating';

export const addApiSpanLabels = (
  span: api.Span | undefined,
  req: AppVersionRequest,
): void => {
  span?.setAttributes({
    [SEMATTRS_DAILY_APPS_VERSION]: getAppVersion(req),
    [SEMATTRS_DAILY_APPS_USER_ID]: req.userId || req.trackingId || 'unknown',
    [SEMATTRS_DAILY_STAFF]: req.isTeamMember,
  });
};

export const addPubsubSpanLabels = (
  span: api.Span,
  subscription: string,
  message: Message | { id: string; data?: Buffer },
): void => {
  span.setAttributes({
    [ATTR_MESSAGING_SYSTEM]: 'pubsub',
    [ATTR_MESSAGING_DESTINATION_NAME]: subscription,
    [ATTR_MESSAGING_MESSAGE_ID]: message.id,
    [ATTR_MESSAGING_MESSAGE_BODY_SIZE]: message.data?.length || 0,
  });
};

const ignorePaths = ['/health', '/liveness', '/metrics'];

export const instrumentations = [
  new HttpInstrumentation({
    // Ignore specific endpoints like health checks or internal metrics
    ignoreIncomingRequestHook: (request) =>
      ignorePaths.some((path) => request.url?.includes(path)),
  }),
  new FastifyOtelInstrumentation({
    registerOnInitialization: true,
    ignorePaths: ({ url }) => ignorePaths.some((path) => url?.includes(path)),
    requestHook: (span, req) => {
      addApiSpanLabels(span, req as AppVersionRequest);
    },
  }),
  new GraphQLInstrumentation({
    mergeItems: true,
    ignoreTrivialResolveSpans: true,
  }),
  // Did not really get anything from IORedis
  new IORedisInstrumentation(),
  // TODO: remove this once pubsub has implemented the new tracing methods
  new GrpcInstrumentation({
    ignoreGrpcMethods: ['ModifyAckDeadline'],
  }),
  // Postgres instrumentation will be supressed if it is a child of typeorm
  new PgInstrumentation(),
  new TypeormInstrumentation({
    suppressInternalInstrumentation: true,
  }),
  new UndiciInstrumentation(),
];

export const subscribeTracingHooks = (serviceName: string): void => {
  dc.subscribe(channelName, (message) => {
    const { fastify } = message as { fastify: FastifyInstance };
    fastify.decorate('tracer', api.trace.getTracer(serviceName));
    fastify.decorateRequest('span');

    fastify.addHook('onRequest', async (req) => {
      req.span = api.trace.getSpan(api.context.active());
    });

    // Decorate the main span with some metadata
    fastify.addHook('onResponse', async (req: AppVersionRequest) => {
      if (req?.span?.isRecording()) {
        addApiSpanLabels(req.span, req);
      }
    });
  });
};

export const createSpanProcessor = (): node.BatchSpanProcessor => {
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  return new node.BatchSpanProcessor(traceExporter);
};

export const runInSpan = async <T>(
  name: string,
  func: (span: api.Span) => Promise<T>,
  options?: api.SpanOptions,
): Promise<T> =>
  api.trace
    .getTracer('runInSpan')
    .startActiveSpan(name, options!, async (span) => {
      try {
        return await func(span);
      } catch (originalError) {
        const err = originalError as Error;

        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: err?.message,
        });
        throw err;
      } finally {
        span.end();
      }
    }) as T;

export const runInSpanSync = <T>(
  name: string,
  func: (span: api.Span) => T,
  options?: api.SpanOptions,
): T =>
  api.trace.getTracer('runInSpan').startActiveSpan(name, options!, (span) => {
    try {
      return func(span);
    } catch (originalError) {
      const err = originalError as Error;

      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: err?.message,
      });
      throw err;
    } finally {
      span.end();
    }
  }) as T;

export const runInRootSpan = async <T>(
  name: string,
  func: (span: api.Span) => Promise<T>,
  options?: api.SpanOptions,
): Promise<T> => runInSpan(name, func, { ...options, root: true });

export const runInRootSpanSync = <T>(
  name: string,
  func: (span: api.Span) => T,
  options?: api.SpanOptions,
): T => runInSpanSync(name, func, { ...options, root: true });
