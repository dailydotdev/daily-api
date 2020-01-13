import './trace';
import logger from './src/logger';
import app from './src/index';
import config from './src/config';
import { migrate } from './src/db';

logger.info('migrating database');
migrate()
  .then(() => {
    const server = app.listen(config.port);

    if (process.env.KEEP_ALIVE_TIMEOUT) {
      server.keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10);
    }
    logger.info(`server is listening to ${config.port}`);
  });
