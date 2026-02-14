// This module MUST be loaded via --require before any application code.
// It instantiates OpenTelemetry instrumentations that monkey-patch require()
// hooks, ensuring all subsequently loaded modules (http, pg, etc.) are patched.
import type { Span } from '@opentelemetry/api';

import FastifyOtelInstrumentation from '@fastify/otel';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { TypeormInstrumentation } from 'opentelemetry-instrumentation-typeorm';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

import {
  type AppVersionRequest,
  enableOpenTelemetry,
  getAppVersion,
  SEMATTRS_DAILY_APPS_USER_ID,
  SEMATTRS_DAILY_APPS_VERSION,
  SEMATTRS_DAILY_STAFF,
} from './common';

export const addApiSpanLabels = (
  span: Span | undefined,
  req: AppVersionRequest,
): void => {
  span?.setAttributes({
    [SEMATTRS_DAILY_APPS_VERSION]: getAppVersion(req),
    [SEMATTRS_DAILY_APPS_USER_ID]: req.userId || req.trackingId || 'unknown',
    [SEMATTRS_DAILY_STAFF]: req.isTeamMember,
  });
};

const ignorePaths = ['/health', '/liveness', '/metrics'];

const getInstrumentations = () => [
  new HttpInstrumentation({
    ignoreIncomingRequestHook: (request) =>
      ignorePaths.some((path) => request.url?.includes(path)),
  }),
  new FastifyOtelInstrumentation({
    registerOnInitialization: true,
    recordExceptions: true,
    ignorePaths: ({ url }) => ignorePaths.some((path) => url?.includes(path)),
    requestHook: (span, req) => {
      addApiSpanLabels(span, req as AppVersionRequest);
    },
  }),
  new GraphQLInstrumentation({
    mergeItems: true,
    ignoreTrivialResolveSpans: true,
  }),
  new PinoInstrumentation(),
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
