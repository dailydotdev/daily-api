import path from 'path';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import KoaPinoLogger from 'koa-pino-logger';
import Router from 'koa-router';
import etag from 'koa-etag';

import { ApolloServer } from 'apollo-server-koa';
import graphqlHTTP from 'koa-graphql';
import { mergeTypes, mergeResolvers, fileLoader } from 'merge-graphql-schemas';
import { makeExecutableSchema } from 'graphql-tools';

import config from './config';
// import compress from './middlewares/compress';
import errorHandler from './middlewares/errorHandler';
import logger from './logger';

import health from './routes/health';
import posts from './routes/posts';
import publications from './routes/publications';
import settings from './routes/settings';
import feeds from './routes/feeds';

import notifications from './routes/notifications';
import tags from './routes/tags';

import post from './models/post';
import publication from './models/publication';

const typeDefs = mergeTypes(fileLoader(path.join(__dirname, 'graphql/schema')));

const resolvers = mergeResolvers(fileLoader(path.join(__dirname, 'graphql/resolvers')));

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const server = new ApolloServer({
  schema,
  context: ({ ctx }) => {
    let user = null;

    if (ctx.request.get('authorization') === `Service ${config.accessSecret}` &&
      ctx.request.get('user-id') && ctx.request.get('logged-in')) {
      // eslint-disable-next-line
      // ctx.state = {
      //   user: {
      //     userId: ctx.request.get('user-id'),
      //   },
      //   service: true,
      // };
      user = {
        userId: ctx.request.get('user-id'),
      };
    } else {
      delete ctx.request.headers['user-id'];
      delete ctx.request.headers['logged-in'];
    }

    return {
      models: {
        post,
        publication,
      },
      user,
      meta: {
        ip: ctx.request.ip,
      },
      config,
    };
  },
  formatError: (err) => {
    // eslint-disable-next-line
    console.log(err);

    return {
      message: err.message,
      code: err.extensions.exception.code,
    };
  },
});

const app = new Koa();

server.applyMiddleware({ app });

app.proxy = true;

// TODO: disabled due to performance issues
// app.use(compress());

app.use(bodyParser());
app.use(KoaPinoLogger({ logger, useLevel: 'debug' }));
app.use(errorHandler());
app.use(etag());

// Machine-to-machine authentication
app.use((ctx, next) => {
  if (ctx.request.get('authorization') === `Service ${config.accessSecret}`
    && ctx.request.get('user-id') && ctx.request.get('logged-in')) {
    // eslint-disable-next-line
    ctx.state = {
      user: {
        userId: ctx.request.get('user-id'),
      },
      service: true,
    };
  } else {
    delete ctx.request.headers['user-id'];
    delete ctx.request.headers['logged-in'];
  }
  return next();
});

const router = new Router({
  prefix: '/v1',
});

router.all('graphql', graphqlHTTP({
  schema,
  graphiql: true,
}));

router.use(feeds.routes(), feeds.allowedMethods());
router.use(posts.routes(), posts.allowedMethods());
router.use(publications.routes(), publications.allowedMethods());
router.use(settings.routes(), settings.allowedMethods());
router.use(notifications.routes(), notifications.allowedMethods());
router.use(tags.routes(), tags.allowedMethods());

app.use(router.routes(), router.allowedMethods());
app.use(health.routes(), health.allowedMethods());

export default app;
