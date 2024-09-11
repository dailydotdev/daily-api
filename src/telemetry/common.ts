import { FastifyRequest } from 'fastify';
export { default as dc } from 'node:diagnostics_channel';
export * from '@opentelemetry/semantic-conventions';
import type { MetricOptions } from '@opentelemetry/api';

export const channelName = 'fastify.initialization';

// Try to get the app version from the header, then query param, then default to unknown
export const getAppVersion = (req: FastifyRequest): string => {
  return req.headers['x-app-version'] || req.query['v'] || 'unknown';
};

export const SEMATTRS_DAILY_APPS_VERSION = 'dailydev.apps.version';
export const SEMATTRS_DAILY_APPS_USER_ID = 'dailydev.apps.userId';

export type CounterOptions = { name: string } & MetricOptions;
