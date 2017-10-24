// eslint-disable-next-line no-unused-vars
import trace from './trace';
// eslint-disable-next-line import/first
import pino from 'pino';
import app from './src/index';
import config from './src/config';

const logger = pino();

app.listen(config.port);
logger.info(`server is listening to ${config.port}`);
