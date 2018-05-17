import Koa from 'koa';
import path from 'path';
import bodyParser from 'koa-bodyparser';
import pino from 'pino';
import KoaPinoLogger from 'koa-pino-logger';
import Router from 'koa-router';
import cors from '@koa/cors';
import session from 'koa-session';
import KnexStore from 'koa-generic-session-knex';
import userAgent from 'koa-useragent';
import etag from 'koa-etag';
import views from 'koa-views';

import config from './config';
import errorHandler from './middlewares/errorHandler';
import db from './db';

import health from './routes/health';
import sources from './routes/sources';
import posts from './routes/posts';
import publications from './routes/publications';
import redirect from './routes/redirect';
import download from './routes/download';
import tweet from './routes/tweet';
import ads from './routes/ads';
import users from './routes/users';

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

app.use(cors({ credentials: true }));
app.use(bodyParser());
app.use(KoaPinoLogger({ logger }));
app.use(errorHandler());
app.use(session({
  key: 'da',
  maxAge: 1000 * 60 * 60 * 24 * 365,
  overwrite: true,
  httpOnly: true,
  signed: true,
  renew: true,
  store: new KnexStore(db, { tableName: 'sessions', sync: true }),
  domain: config.cookies.domain,
}, app));
app.use(userAgent);
app.use(etag());
app.use(views(path.join(__dirname, 'views'), {
  map: {
    hbs: 'handlebars',
  },
}));

const router = new Router({
  prefix: '/v1',
});

router.use(sources.routes(), sources.allowedMethods());
router.use(posts.routes(), posts.allowedMethods());
router.use(publications.routes(), publications.allowedMethods());
router.use(tweet.routes(), tweet.allowedMethods());
router.use(ads.routes(), ads.allowedMethods());
router.use(users.routes(), users.allowedMethods());

app.use(router.routes(), router.allowedMethods());
app.use(redirect.routes(), redirect.allowedMethods());
app.use(download.routes(), download.allowedMethods());
app.use(health.routes(), health.allowedMethods());


export default app;
