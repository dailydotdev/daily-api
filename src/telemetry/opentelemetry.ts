import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Message } from '@google-cloud/pubsub';

import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { TypeormInstrumentation } from 'opentelemetry-instrumentation-typeorm';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

import dc from 'node:diagnostics_channel';

import { NodeSDK, logs, node, api, resources } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { GcpDetectorSync } from '@google-cloud/opentelemetry-resource-util';

import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';

import {
  AppVersionRequest,
  channelName,
  enableOpenTelemetryTracing,
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
} from '@opentelemetry/semantic-conventions/incubating';

const resourceDetectors = [
  resources.envDetectorSync,
  resources.hostDetectorSync,
  resources.osDetectorSync,
  resources.processDetectorSync,
  containerDetector,
  gcpDetector,
  new GcpDetectorSync(),
];

export const addApiSpanLabels = (
  span: api.Span | undefined,
  req: AppVersionRequest,
  // TODO: see if we want to add some attributes from the response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  res?: FastifyReply,
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

const instrumentations = [
  new HttpInstrumentation({
    // Ignore specific endpoints like health checks or internal metrics
    ignoreIncomingRequestHook: (request) => {
      const ignorePaths = ['/health', '/liveness', '/metrics'];
      return ignorePaths.some((path) => request.url?.includes(path));
    },
  }),
  new FastifyInstrumentation({
    requestHook: (span, info) => {
      addApiSpanLabels(span, info.request);
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

api.diag.setLogger(new api.DiagConsoleLogger(), api.DiagLogLevel.INFO);

export const tracer = (serviceName: string) => {
  if (!enableOpenTelemetryTracing) {
    return {
      start: () => {},
      tracer: api.trace.getTracer('noop'),
    };
  }

  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  const spanProcessor = new node.BatchSpanProcessor(traceExporter);

  const sdk = new NodeSDK({
    serviceName,
    logRecordProcessors: [
      new logs.SimpleLogRecordProcessor(new logs.ConsoleLogRecordExporter()),
    ],
    spanProcessors: [spanProcessor],
    instrumentations,
    resourceDetectors,
  });

  // @ts-expect-error - types are not generic in dc subscribe
  dc.subscribe(channelName, ({ fastify }: { fastify: FastifyInstance }) => {
    fastify.decorate('tracer', api.trace.getTracer(serviceName));
    fastify.decorateRequest('span', null);

    fastify.addHook('onRequest', async (req) => {
      req.span = api.trace.getSpan(api.context.active());
    });

    // Decorate the main span with some metadata
    fastify.addHook('onResponse', async (req: AppVersionRequest, res) => {
      if (req?.span?.isRecording()) {
        addApiSpanLabels(req.span, req, res);
      }
    });
  });

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => sdk.shutdown().catch(console.error));
  });

  return {
    start: () => {
      sdk.start();
    },
    tracer,
  };
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

export { api as opentelemetry };
