import { env } from 'node:process';

import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';
import pino, { type LoggerOptions } from 'pino';

const DEFAULT_SEVERITY_NUMBER_MAP = {
  10: 1, // TRACE
  20: 5, // DEBUG
  30: 9, // INFO
  40: 13, // WARN
  50: 17, // ERROR
  60: 21, // FATAL
};

const pinoLoggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  messageKey: 'body',
  base: null,
  timestamp: () => `,"timestamp":"${Date.now()}000000"`,
  formatters: {
    level(severity, level) {
      return {
        severityText: severity.toUpperCase(),
        severityNumber:
          DEFAULT_SEVERITY_NUMBER_MAP[
            level as keyof typeof DEFAULT_SEVERITY_NUMBER_MAP
          ] || DEFAULT_SEVERITY_NUMBER_MAP[30], // default to INFO
      };
    },
  },
};

const devTransport: LoggerOptions['transport'] = {
  target: 'pino-pretty',
  options: {
    levelKey: 'severityText',
    messageKey: 'body',
    timestampKey: 'timestamp',
  },
};

export const loggerConfig: LoggerOptions =
  env.NODE_ENV === 'production' && env.OTEL_LOGGER_FORMAT === 'gcp'
    ? createGcpLoggingPinoConfig(
        {
          serviceContext: {
            service: env.OTEL_SERVICE_NAME || 'service',
            version: env.OTEL_SERVICE_VERSION || 'latest',
          },
        },
        pinoLoggerOptions,
      )
    : {
        ...pinoLoggerOptions,
        ...(env.NODE_ENV !== 'production' && { transport: devTransport }),
      };

export const logger = pino(loggerConfig);
