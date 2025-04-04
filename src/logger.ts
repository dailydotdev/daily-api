import { env } from 'node:process';

import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';
import pino, { type LoggerOptions } from 'pino';

const pinoLoggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL || 'info',
};

export const loggerConfig: LoggerOptions =
  env.NODE_ENV === 'production'
    ? createGcpLoggingPinoConfig(
        {
          serviceContext: {
            service: env.SERVICE_NAME || 'service',
            version: env.SERVICE_VERSION || 'latest',
          },
        },
        pinoLoggerOptions,
      )
    : pinoLoggerOptions;

export const logger = pino(loggerConfig);
