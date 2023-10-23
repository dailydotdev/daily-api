import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Message } from '@google-cloud/pubsub';

import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { TypeormInstrumentation } from 'opentelemetry-instrumentation-typeorm';

import {
  NodeSDK,
  logs,
  node,
  api,
  resources,
  metrics,
} from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { SemanticAttributes as SemAttr } from '@opentelemetry/semantic-conventions';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { MetricExporter } from '@google-cloud/opentelemetry-cloud-monitoring-exporter';
import { CloudPropagator } from '@google-cloud/opentelemetry-cloud-trace-propagator';

import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';

import dc from 'node:diagnostics_channel';
const channel = dc.channel('fastify.initialization');

const isProd = process.env.NODE_ENV === 'production';
const resourceDetectors = [
  resources.envDetectorSync,
  resources.hostDetectorSync,
  resources.osDetectorSync,
  resources.processDetectorSync,
  containerDetector,
  gcpDetector,
];

// Try to get the app version from the header, then query param, then default to unknown
export const getAppVersion = (req: FastifyRequest): string => {
  return req.headers['x-app-version'] || req.query['v'] || 'unknown';
};

export const TelemetrySemanticAttributes = {
  ...SemAttr,
  DAILY_APPS_VERSION: 'dailydev.apps.version',
  DAILY_APPS_USER_ID: 'dailydev.apps.userId',
};

export const addApiSpanLabels = (
  span: api.Span,
  req: FastifyRequest,
  // TODO: see if we want to add some attributes from the response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  res?: FastifyReply,
): void => {
  span.setAttributes({
    [TelemetrySemanticAttributes.DAILY_APPS_VERSION]: getAppVersion(req),
    [TelemetrySemanticAttributes.DAILY_APPS_USER_ID]:
      req.userId || req.trackingId || 'unknown',
  });
};

export const addPubsubSpanLabels = (
  span: api.Span,
  subscription: string,
  message: Message | { id: string; data?: Buffer },
): void => {
  span.setAttributes({
    [TelemetrySemanticAttributes.MESSAGING_SYSTEM]: 'pubsub',
    [TelemetrySemanticAttributes.MESSAGING_DESTINATION]: subscription,
    [TelemetrySemanticAttributes.MESSAGING_MESSAGE_ID]: message.id,
    [TelemetrySemanticAttributes.MESSAGING_MESSAGE_PAYLOAD_SIZE_BYTES]:
      message.data.length,
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
      addApiSpanLabels(span, info.request as FastifyRequest);
    },
  }),
  new GraphQLInstrumentation({
    mergeItems: true,
    ignoreTrivialResolveSpans: true,
  }),
  new PinoInstrumentation(),
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
];

api.diag.setLogger(new api.DiagConsoleLogger(), api.DiagLogLevel.INFO);

export const tracer = (serviceName: string) => {
  const traceExporter = isProd
    ? new TraceExporter()
    : new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      });

  const spanProcessor = isProd
    ? new node.BatchSpanProcessor(traceExporter)
    : new node.SimpleSpanProcessor(traceExporter);

  const metricReader = isProd
    ? new metrics.PeriodicExportingMetricReader({
        exportIntervalMillis: 10_000,
        exporter: new MetricExporter(),
      })
    : new PrometheusExporter({}, () => {
        const { endpoint, port } = PrometheusExporter.DEFAULT_OPTIONS;
        console.log(`metrics endpoint: http://localhost:${port}${endpoint}`);
      });

  const sdk = new NodeSDK({
    serviceName,
    logRecordProcessor: new logs.SimpleLogRecordProcessor(
      new logs.ConsoleLogRecordExporter(),
    ),
    spanProcessor,
    instrumentations,
    resourceDetectors,
    metricReader,
    textMapPropagator: new CloudPropagator(),
  });

  channel.subscribe(({ fastify }: { fastify: FastifyInstance }) => {
    const meter = api.metrics.getMeter(serviceName);
    const requestCounter = meter.createCounter('requests');

    fastify.decorate('tracer', api.trace.getTracer('fastify'));
    fastify.decorateRequest('span', null);

    fastify.addHook('onRequest', async (req) => {
      req.span = api.trace.getSpan(api.context.active());
    });

    // Decorate the main span with some metadata
    fastify.addHook('onResponse', async (req, res) => {
      addApiSpanLabels(req.span, req, res);

      requestCounter.add(1, {
        [TelemetrySemanticAttributes.HTTP_METHOD]: req.method,
        [TelemetrySemanticAttributes.HTTP_ROUTE]: req.routeOptions.url,
        [TelemetrySemanticAttributes.HTTP_STATUS_CODE]: res.statusCode,
        [TelemetrySemanticAttributes.DAILY_APPS_VERSION]: getAppVersion(req),
      });
    });
  });

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => sdk.shutdown().catch(console.error));
  });

  return {
    start: () => sdk.start(),
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
    .startActiveSpan(name, options, async (span) => {
      try {
        return await func(span);
      } catch (err) {
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: err?.message,
        });
        throw err;
      } finally {
        span.end();
      }
    });

export const runInSpanSync = <T>(
  name: string,
  func: (span: api.Span) => T,
  options?: api.SpanOptions,
): T =>
  api.trace.getTracer('runInSpan').startActiveSpan(name, options, (span) => {
    try {
      return func(span);
    } catch (err) {
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: err?.message,
      });
      throw err;
    } finally {
      span.end();
    }
  });

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
