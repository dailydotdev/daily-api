import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import KoaPinoLogger from 'koa-pino-logger';
import Router from 'koa-router';
import etag from 'koa-etag';

import { ApolloServer, gql } from 'apollo-server-koa';
import graphqlHTTP from 'koa-graphql';

import config from './config';
// import compress from './middlewares/compress';
import errorHandler from './middlewares/errorHandler';
import logger from './logger';

import health from './routes/health';
import posts from './routes/posts';
import publications from './routes/publications';
import tweet from './routes/tweet';
import settings from './routes/settings';
import feeds from './routes/feeds';
import notifications from './routes/notifications';
import tags from './routes/tags';

const typeDefs = gql`
  type Query {
    hello: String
  }
`;

const resolvers = {
  Query: {
    hello() {
      return 'andrei';
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

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
  // schema,
  graphiql: true,
}));

router.use(feeds.routes(), feeds.allowedMethods());
router.use(posts.routes(), posts.allowedMethods());
router.use(publications.routes(), publications.allowedMethods());
router.use(tweet.routes(), tweet.allowedMethods());
router.use(settings.routes(), settings.allowedMethods());
router.use(notifications.routes(), notifications.allowedMethods());
router.use(tags.routes(), tags.allowedMethods());

app.use(router.routes(), router.allowedMethods());
app.use(health.routes(), health.allowedMethods());

export default app;
