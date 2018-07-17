// eslint-disable-next-line no-unused-vars
import trace from './trace';
// eslint-disable-next-line import/first
import logger from './src/logger';
import app from './src/index';
import config from './src/config';
import { migrate } from './src/db';
import subscriber from './src/subscriber';

logger.info('migrating database');
migrate()
  .then(() => subscriber())
  .then(() => {
    app.listen(config.port);
    logger.info(`server is listening to ${config.port}`);
  });
