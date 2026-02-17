import { env } from 'node:process';

import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';
import pino, { type LoggerOptions } from 'pino';

const isProd = env.NODE_ENV === 'production';

const OTEL_SEV_MAPPING = {
  10: 1, // TRACE
  20: 5, // DEBUG
  30: 9, // INFO
  40: 13, // WARN
  50: 17, // ERROR
  60: 21, // FATAL
};

const devTransport: LoggerOptions['transport'] = {
  target: 'pino-pretty',
};

const buildLoggerConfig = (): LoggerOptions => {
  const baseOptions: LoggerOptions = {
    level: env.LOG_LEVEL || 'info',
  };

  if (!isProd) {
    return { ...baseOptions, transport: devTransport };
  }

  if (isProd && env.OTEL_LOGGER_FORMAT === 'gcp') {
    return createGcpLoggingPinoConfig(
      {
        serviceContext: {
          service: env.OTEL_SERVICE_NAME,
          version: env.OTEL_SERVICE_VERSION,
        },
      },
      baseOptions,
    );
  }

  return {
    ...baseOptions,
    timestamp: () => `,"timestamp":"${Date.now()}000000"`,
    messageKey: 'body',
    formatters: {
      level: (severity, level) => ({
        severityText: severity.toUpperCase(),
        severityNumber:
          OTEL_SEV_MAPPING[level as keyof typeof OTEL_SEV_MAPPING] ||
          OTEL_SEV_MAPPING[30], // default to INFO
      }),
    },
  };
};

export const loggerConfig: LoggerOptions = buildLoggerConfig();

export const logger = pino(loggerConfig);
