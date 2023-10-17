// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { TypeormInstrumentation } from 'opentelemetry-instrumentation-typeorm';

import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import * as opentelemetry from '@opentelemetry/api';
import type { Span, SpanOptions } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { CloudPropagator } from '@google-cloud/opentelemetry-cloud-trace-propagator';

// import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
// import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

import {
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
} from '@opentelemetry/resources';
import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';

import {
  // SemanticResourceAttributes,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';

import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

import { diag, DiagConsoleLogger } from '@opentelemetry/api';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import dc from 'node:diagnostics_channel';
import { Message } from '@google-cloud/pubsub';
const channel = dc.channel('fastify.initialization');

declare module 'fastify' {
  interface FastifyRequest {
    span: opentelemetry.Span;
  }

  interface FastifyInstance {
    tracer: opentelemetry.Tracer;
  }
}

// const metricExporter = new OTLPMetricExporter({
//   // hostname: 'jaeger-collector',
//   url: `http://${process.env.OTLP_COLLECTOR_HOST}:${process.env.OTLP_COLLECTOR_PORT}`,
// });
const isProd = process.env.NODE_ENV === 'production';
const resourceDetectors = [
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
  containerDetector,
  gcpDetector,
];

const traceExporter = isProd
  ? new TraceExporter({
      // /** option 1. provide a service account key json */
      // keyFile: './service_account_key.json',
      // keyFilename: './service_account_key.json',
      //
      // /** option 2. provide credentials directly */
      // credentials: {
      //   client_email: 'string',
      //   private_key: 'string',
      // },
    })
  : new OTLPTraceExporter({
      // hostname: 'jaeger-collector',
      url: `http://${process.env.OTLP_COLLECTOR_HOST}:${process.env.OTLP_COLLECTOR_PORT}`,
    });

const spanProcessor = isProd
  ? new BatchSpanProcessor(traceExporter)
  : new SimpleSpanProcessor(traceExporter);

export const addApiSpanLabels = (
  span: opentelemetry.Span,
  req: FastifyRequest,
  // TODO: see if we want to add some attributes from the response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  res?: FastifyReply,
): void => {
  span.setAttributes({
    ['dailydev.apps.version']: req.query['v'] || 'unknown',
    ['dailydev.apps.userId']: req.userId || 'unknown',
    ['dailydev.heimdall.session']: req.cookies['das'] || 'unknown',
  });
};

export const addPubsubSpanLabels = (
  span: opentelemetry.Span,
  subscription: string,
  message: Message | { id: string; data?: Buffer },
): void => {
  span.setAttributes({
    [SemanticAttributes.MESSAGING_MESSAGE_ID]: message.id,
    [SemanticAttributes.MESSAGING_MESSAGE_PAYLOAD_SIZE_BYTES]:
      message.data.length,
  });
};

const instrumentations = [
  new HttpInstrumentation(),
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
  new IORedisInstrumentation({
    // enabled: false,
  }),
  // @TODO: Nothing yet?
  new GrpcInstrumentation({
    ignoreGrpcMethods: ['ModifyAckDeadline'],
  }),
  // Postgres instrumentation will be supressed if it is a child of typeorm
  new PgInstrumentation(),
  new TypeormInstrumentation({
    suppressInternalInstrumentation: true,
  }),
];

diag.setLogger(new DiagConsoleLogger(), opentelemetry.DiagLogLevel.INFO);

export const context = opentelemetry.context;
export const trace = opentelemetry.trace;
export const getTracer = opentelemetry.trace.getTracer;

export const tracer = (serviceName: string) => {
  const sdk = new NodeSDK({
    serviceName,
    logRecordProcessor: new SimpleLogRecordProcessor(
      new ConsoleLogRecordExporter(),
    ),
    spanProcessor,
    instrumentations,
    resourceDetectors,
    textMapPropagator: new CloudPropagator(),
  });

  const tracer = opentelemetry.trace.getTracer('fastify');
  const context = opentelemetry.context;
  const trace = opentelemetry.trace;

  channel.subscribe(({ fastify }: { fastify: FastifyInstance }) => {
    fastify.decorate('tracer', tracer);

    // TODO: see if this is needed
    fastify.decorateRequest('span', null);
    fastify.addHook('onRequest', async (req) => {
      req.span = trace.getSpan(context.active());
    });

    // Decorate the main span with some metadata
    fastify.addHook('onResponse', async (req, res) => {
      const currentSpan = trace.getSpan(context.active());
      addApiSpanLabels(currentSpan, req, res);
    });
  });

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => sdk.shutdown().catch(console.error));
  });

  return {
    start: () => sdk.start(),
    tracer,
    context,
    trace,
  };
};

export const runInSpan = async <T>(
  name: string,
  func: (span: Span) => Promise<T>,
  options?: SpanOptions,
): Promise<T> =>
  trace.getTracer('runInSpan').startActiveSpan(name, options, async (span) => {
    try {
      return await func(span);
    } catch (err) {
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: err?.message,
      });
      throw err;
    } finally {
      span.end();
    }
  });

export const runInSpanSync = <T>(
  name: string,
  func: (span: Span) => T,
  options?: SpanOptions,
): T =>
  trace.getTracer('runInSpan').startActiveSpan(name, options, (span) => {
    try {
      return func(span);
    } catch (err) {
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: err?.message,
      });
      throw err;
    } finally {
      span.end();
    }
  });

export const runInRootSpan = async <T>(
  name: string,
  func: (span: Span) => Promise<T>,
  options?: SpanOptions,
): Promise<T> => runInSpan(name, func, { ...options, root: true });

export const runInRootSpanSync = <T>(
  name: string,
  func: (span: Span) => T,
  options?: SpanOptions,
): T => runInSpanSync(name, func, { ...options, root: true });
