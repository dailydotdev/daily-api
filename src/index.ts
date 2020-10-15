import 'reflect-metadata';
import fastify from 'fastify';
import { FastifyInstance, FastifyRequest } from 'fastify';
import helmet from 'fastify-helmet';
import cookie from 'fastify-cookie';
import cors from 'fastify-cors';

import './config';
import './profiler';

import trace from './trace';
import auth from './auth';
import compatibility from './compatibility';
import routes from './routes';

import { Context } from './Context';
import createApolloServer from './apollo';
import { createOrGetConnection } from './db';
import { stringifyHealthCheck } from './common';

export default async function app(): Promise<FastifyInstance> {
  const isProd = process.env.NODE_ENV === 'production';
  const connection = await createOrGetConnection();

  const app = fastify({
    logger: true,
    disableRequestLogging: true,
    trustProxy: isProd,
  });

  app.register(helmet);
  app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? /daily\.dev$/ : true,
  });
  app.register(cookie, { secret: process.env.COOKIES_KEY });
  app.register(trace, { enabled: isProd });
  app.register(auth, { secret: process.env.ACCESS_SECRET });

  app.get('/health', (req, res) => {
    res.type('application/health+json');
    res.send(stringifyHealthCheck({ status: 'ok' }));
  });

  const server = await createApolloServer({
    context: (req: FastifyRequest): Context => new Context(req, connection),
    playground: isProd
      ? false
      : { settings: { 'request.credentials': 'include' } },
    logger: app.log,
  });
  app.register(server.createHandler({ disableHealthCheck: true, cors: false }));

  app.register(compatibility, { prefix: '/v1' });
  app.register(routes, { prefix: '/' });

  return app;
}
