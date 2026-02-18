import { FastifyRequest } from 'fastify';
import type { MetricOptions } from '@opentelemetry/api';
import { unwrapArray } from '../common/array';

export const enableOpenTelemetry = process.env.OTEL_ENABLED === 'true';
export const channelName = 'fastify.initialization';

// Try to get the app version from the header, then query param, then default to unknown
export const getAppVersion = (req: AppVersionRequest): string => {
  const headerVersion = unwrapArray(req.headers['x-app-version']);

  if (headerVersion) {
    return headerVersion;
  }

  const queryVersion = unwrapArray(req.query['v']);

  if (queryVersion) {
    return queryVersion;
  }

  return 'unknown';
};

export const SEMATTRS_DAILY_STAFF = 'dailydev.staff';
export const SEMATTRS_DAILY_APPS_VERSION = 'dailydev.apps.version';
export const SEMATTRS_DAILY_APPS_USER_ID = 'dailydev.apps.userId';

export type CounterOptions = { name: string } & MetricOptions;

export type AppVersionRequest = FastifyRequest<{
  Headers: {
    'x-app-version'?: string | string[];
  };
  Querystring: {
    v?: string | string[];
  };
}>;
