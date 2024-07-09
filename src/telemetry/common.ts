import { FastifyRequest } from 'fastify';
import dc from 'node:diagnostics_channel';
import { SemanticAttributes as SemAttr } from '@opentelemetry/semantic-conventions';
import type { MetricOptions } from '@opentelemetry/api';

export const channel = dc.channel('fastify.initialization');

// Try to get the app version from the header, then query param, then default to unknown
export const getAppVersion = (req: FastifyRequest): string => {
  return req.headers['x-app-version'] || req.query['v'] || 'unknown';
};

export const TelemetrySemanticAttributes = {
  ...SemAttr,
  DAILY_APPS_VERSION: 'dailydev.apps.version',
  DAILY_APPS_USER_ID: 'dailydev.apps.userId',
};

export type CounterOptions = { name: string } & MetricOptions;
