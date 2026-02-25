// This module MUST be loaded via --require before any application code.
// It instantiates OpenTelemetry instrumentations that monkey-patch require()
// hooks, ensuring all subsequently loaded modules (http, pg, etc.) are patched.
import { ClientRequest } from 'node:http';

import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { TypeormInstrumentation } from '@opentelemetry/instrumentation-typeorm';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

import { enableOpenTelemetry, ignoredPaths } from './common';

const getInstrumentations = () => [
  new HttpInstrumentation({
    requestHook: (span, req) => {
      if (!span.isRecording()) return;
      const suffix =
        req instanceof ClientRequest ? ` ${req.host}${req.path}` : req.url;
      span.updateName(`${req.method} ${suffix}`);
    },
    ignoreIncomingRequestHook: (request) =>
      ignoredPaths.some((path) => request.url?.includes(path)),
  }),
  new GraphQLInstrumentation({
    mergeItems: true,
    ignoreTrivialResolveSpans: true,
    ignoreResolveSpans: true,
  }),
  new PinoInstrumentation({
    logKeys: {
      traceId: 'traceId',
      spanId: 'spanId',
      traceFlags: 'traceFlags',
    },
  }),
  new GrpcInstrumentation({
    ignoreGrpcMethods: ['ModifyAckDeadline'],
  }),
  // Postgres instrumentation will be suppressed if it is a child of typeorm
  new PgInstrumentation(),
  new TypeormInstrumentation({
    suppressInternalInstrumentation: true,
  }),
  new UndiciInstrumentation(),
];

export const instrumentations = enableOpenTelemetry
  ? getInstrumentations()
  : [];
