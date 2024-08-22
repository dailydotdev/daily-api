import pino, { LoggerOptions } from 'pino';

// https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
const PinoLevelToSeverityLookup = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

export const loggerConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  messageKey: 'message',
  formatters: {
    level(label, number) {
      return {
        severity:
          PinoLevelToSeverityLookup[
            label as keyof typeof PinoLevelToSeverityLookup
          ] || PinoLevelToSeverityLookup['info'],
        level: number,
      };
    },
  },
};

export const logger = pino(loggerConfig);
