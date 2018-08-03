import Koa from 'koa';
import path from 'path';
import bodyParser from 'koa-bodyparser';
import KoaPinoLogger from 'koa-pino-logger';
import Router from 'koa-router';
import session from 'koa-session';
import KnexStore from 'koa-generic-session-knex';
import userAgent from 'koa-useragent';
import etag from 'koa-etag';
import views from 'koa-views';
import cors from '@koa/cors';

import config from './config';
import errorHandler from './middlewares/errorHandler';
import db from './db';
import logger from './logger';
import { verify as verifyJwt } from './jwt';

import health from './routes/health';
import sources from './routes/sources';
import posts from './routes/posts';
import publications from './routes/publications';
import redirect from './routes/redirect';
import download from './routes/download';
import tweet from './routes/tweet';
import ads from './routes/ads';
import users from './routes/users';
import auth from './routes/auth';
import settings from './routes/settings';
import feeds from './routes/feeds';

const app = new Koa();

app.keys = [config.cookies.key];

app.proxy = config.env === 'production';

app.use(cors({
  credentials: true,
  origin(ctx) {
    const requestOrigin = ctx.get('Origin');
    if (config.cors.origin.indexOf(requestOrigin) > -1) {
      return requestOrigin;
    }
    return false;
  },
}));
app.use(bodyParser());
app.use(KoaPinoLogger({ logger }));
app.use(errorHandler());
app.use(verifyJwt);
app.use(session({
  key: 'da',
  maxAge: 1000 * 60 * 60 * 24 * 365,
  overwrite: true,
  httpOnly: true,
  signed: config.env !== 'test',
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

router.use(feeds.routes(), feeds.allowedMethods());
router.use(sources.routes(), sources.allowedMethods());
router.use(posts.routes(), posts.allowedMethods());
router.use(publications.routes(), publications.allowedMethods());
router.use(tweet.routes(), tweet.allowedMethods());
router.use(ads.routes(), ads.allowedMethods());
router.use(users.routes(), users.allowedMethods());
router.use(auth.routes(), auth.allowedMethods());
router.use(settings.routes(), settings.allowedMethods());

app.use(router.routes(), router.allowedMethods());
app.use(redirect.routes(), redirect.allowedMethods());
app.use(download.routes(), download.allowedMethods());
app.use(health.routes(), health.allowedMethods());


export default app;
