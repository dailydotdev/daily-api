import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import pino from 'pino';
import KoaPinoLogger from 'koa-pino-logger';
import Router from 'koa-router';
import cors from '@koa/cors';
import session from 'koa-session';
import KnexStore from 'koa-generic-session-knex';
import userAgent from 'koa-useragent';

import config from './config';
import errorHandler from './middlewares/errorHandler';
import db from './db';

import health from './routes/health';
import sources from './routes/sources';
import posts from './routes/posts';
import redirect from './routes/redirect';

const app = new Koa();

const loggerOptions = (() => {
  if (config.env === 'test') {
    return { level: 'error' };
  }
  return null;
})();

const logger = pino(loggerOptions);

app.keys = [config.cookies.key];

app.proxy = config.env === 'production';

app.use(cors({ origin: config.cors.origin }));
app.use(bodyParser());
app.use(KoaPinoLogger({ logger }));
app.use(errorHandler());
app.use(session({
  key: 'session',
  maxAge: 1000 * 60 * 60 * 24 * 365,
  overwrite: true,
  httpOnly: true,
  signed: true,
  rolling: true,
  store: new KnexStore(db, { tableName: 'sessions', sync: true }),
  domain: config.cookies.domain,
}, app));
app.use(userAgent);

const router = new Router({
  prefix: '/v1',
});

router.use(sources.routes(), sources.allowedMethods());
router.use(posts.routes(), posts.allowedMethods());

app.use(router.routes(), router.allowedMethods());
app.use(redirect.routes(), redirect.allowedMethods());
app.use(health.routes(), health.allowedMethods());

export default app;
