import pino from 'pino';

import { pinoLoggerConfig } from '@dailydotdev/node-common/logger';

export const logger = pino<never>(pinoLoggerConfig);
