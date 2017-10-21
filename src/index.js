import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import pino from 'pino';
import KoaPinoLogger from 'koa-pino-logger';
import Router from 'koa-router';

import config from './config';
import errorHandler from './middlewares/errorHandler';

import health from './routes/health';
import sources from './routes/sources';
import posts from './routes/posts';

const app = new Koa();

const loggerOptions = (() => {
  if (config.env === 'test') {
    return { level: 'error' };
  }
  return null;
})();

const logger = pino(loggerOptions);

app.use(bodyParser());
app.use(KoaPinoLogger({ logger }));
app.use(errorHandler());

const router = new Router({
  prefix: '/v1',
});

router.use(sources.routes(), sources.allowedMethods());
router.use(posts.routes(), posts.allowedMethods());

app.use(router.routes(), router.allowedMethods());
app.use(health.routes(), health.allowedMethods());

export default app;
