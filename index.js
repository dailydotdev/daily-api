import trace from '@google-cloud/trace-agent';
import pino from 'pino';
import app from './src/index';
import config from './src/config';
import { createTables } from './src/db';

if (config.env === 'production') {
  trace.start();
}

const logger = pino();

createTables()
  .then(() => {
    logger.info('database tables created!');
    app.listen(config.port);
    logger.info(`server is listening to ${config.port}`);
  })
  .catch((err) => {
    logger.error(`failed to create database tables ${err}`);
    process.exit(1);
  });
