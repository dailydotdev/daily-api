import 'reflect-metadata';
import fastify, { FastifyRequest, FastifyInstance } from 'fastify';
import helmet from 'fastify-helmet';
import cookie from 'fastify-cookie';
import cors from 'fastify-cors';
import mercurius from 'mercurius';
import MercuriusGQLUpload from 'mercurius-upload';
import fastifyWebsocket from 'fastify-websocket';

import './config';
import './profiler';

import trace from './trace';
import auth from './auth';
import compatibility from './compatibility';
import routes from './routes';

import { Context } from './Context';
import { schema } from './graphql';
import { createOrGetConnection } from './db';
import { stringifyHealthCheck } from './common';
import { GraphQLError } from 'graphql';

export default async function app(
  contextFn?: (request: FastifyRequest) => Context,
): Promise<FastifyInstance> {
  const isProd = process.env.NODE_ENV === 'production';
  const connection = await createOrGetConnection();

  const app = fastify({
    logger: true,
    disableRequestLogging: true,
    trustProxy: isProd,
  });
  app.server.keepAliveTimeout = 650 * 1000;

  app.register(helmet);
  app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? /daily\.dev$/ : true,
    credentials: true,
  });
  app.register(cookie, { secret: process.env.COOKIES_KEY });
  app.register(trace, { enabled: isProd });
  app.register(auth, { secret: process.env.ACCESS_SECRET });

  app.setErrorHandler((err, req, res) => {
    req.log.error({ err }, err.message);
    res.code(500).send({ statusCode: 500, error: 'Internal Server Error' });
  });

  app.get('/health', (req, res) => {
    res.type('application/health+json');
    res.send(stringifyHealthCheck({ status: 'ok' }));
  });

  app.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576,
      verifyClient: (info, next) => next(true),
    },
  });

  app.register(MercuriusGQLUpload, {
    maxFileSize: 1024 * 1024 * 2,
    maxFiles: 1,
  });

  app.register(mercurius, {
    schema,
    context:
      contextFn ?? ((request): Context => new Context(request, connection)),
    queryDepth: 10,
    subscription: {
      context: (wsConnection, request): Context =>
        new Context(request, connection),
    },
    graphiql: !isProd,
    errorFormatter(execution) {
      return {
        statusCode: 200,
        response: {
          data: execution.data,
          errors: execution.errors.map((error): GraphQLError => {
            const newError = { ...error };
            if (isProd) {
              newError.originalError = undefined;
            }
            if (!error.originalError) {
              newError.extensions = {
                code: 'GRAPHQL_VALIDATION_FAILED',
              };
            } else if (error.originalError?.name === 'EntityNotFoundError') {
              newError.message = 'Entity not found';
              newError.extensions = {
                code: 'NOT_FOUND',
              };
            }
            return newError;
          }),
        },
      };
    },
  });

  app.register(compatibility, { prefix: '/v1' });
  app.register(routes, { prefix: '/' });

  return app;
}
