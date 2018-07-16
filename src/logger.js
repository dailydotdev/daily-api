import pino from 'pino';
import config from './config';

const loggerOptions = (() => {
  if (config.env === 'test') {
    return { level: 'error' };
  }
  return null;
})();

export default pino(loggerOptions);
