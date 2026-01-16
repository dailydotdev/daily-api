import 'reflect-metadata';
import fastify, {
  FastifyRequest,
  FastifyInstance,
  FastifyError,
  FastifyReply,
  type FastifyRegisterOptions,
} from 'fastify';
import fastifyRawBody from 'fastify-raw-body';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import mercurius, { MercuriusError } from 'mercurius';
import MercuriusGQLUpload from 'mercurius-upload';
import MercuriusCache from 'mercurius-cache';
import proxy, { type FastifyHttpProxyOptions } from '@fastify/http-proxy';
import { NoSchemaIntrospectionCustomRule } from 'graphql';

import './config';

import tracking from './tracking';
import auth from './auth';
import compatibility from './compatibility';
import routes from './routes';
import { Context } from './Context';
import { schema } from './graphql';
import createOrGetConnection from './db';
import { stringifyHealthCheck } from './common';
import { GraphQLError } from 'graphql';
import cookie, { FastifyCookieOptions } from '@fastify/cookie';
import { getSubscriptionSettings } from './subscription';
import { ioRedisPool } from './redis';
import { loadFeatures } from './growthbook';
import { runInRootSpan } from './telemetry';
import { loggerConfig } from './logger';
import { getTemporalClient } from './temporal/client';
import { BrokenCircuitError } from 'cockatiel';
import { remoteConfig } from './remoteConfig';
import { ZodError } from 'zod';
import { closeClickHouseClient } from './common/clickhouse';
import { GQL_MAX_FILE_SIZE } from './config';

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

const userExtendKey = (
  source: unknown,
  args: unknown,
  ctx: Context,
): string | undefined => (ctx.userId ? `user:${ctx.userId}` : undefined);

const trackingExtendKey = (
  source: unknown,
  args: unknown,
  ctx: Context,
): string | undefined =>
  ctx.trackingId ? `tracking:${ctx.trackingId}` : undefined;

// readiness probe is set failureThreshold: 2, periodSeconds: 2 (4s) + small delay.
const GRACEFUL_DELAY = 2 * 2 * 1000 + 5000;

export default async function app(
  contextFn?: (request: FastifyRequest) => Context,
): Promise<FastifyInstance> {
  let isTerminating = false;
  const isProd = process.env.NODE_ENV === 'production';
  const connection = await runInRootSpan(
    'createOrGetConnection',
    createOrGetConnection,
  );

  const app = fastify({
    logger: loggerConfig,
    disableRequestLogging: true,
    trustProxy: true,
    routerOptions: {
      useSemicolonDelimiter: true,
    },
  });

  app.log.info('loading features');
  await loadFeatures(app.log);

  const gracefulShutdown = () => {
    app.log.info('starting termination');
    isTerminating = true;
    setTimeout(async () => {
      const client = await getTemporalClient();
      await app.close();
      await connection.destroy();
      await ioRedisPool.end();
      if (client) {
        await client.connection.close();
      }
      await closeClickHouseClient();
      process.exit();
    }, GRACEFUL_DELAY);
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  app.register(helmet);

  const originRegex = /^(?:https:\/\/)?(?:[\w-]+\.)*daily\.dev$/;

  app.register(cors, {
    origin: async (origin?: string) => {
      if (!isProd) {
        return true;
      }

      const originString = origin as string;

      if (remoteConfig.vars.origins?.includes(originString)) {
        return true;
      }

      if (originRegex.test(originString)) {
        return true;
      }

      return [false];
    },
    credentials: true,
    cacheControl: 86400,
    maxAge: 86400,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });
  app.register(cookie, {
    secret: process.env.COOKIES_KEY,
  }) as FastifyCookieOptions;
  app.register(auth, { secret: process.env.ACCESS_SECRET });
  app.register(tracking);
  app.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });

  app.setErrorHandler((err: Error, req, res) => {
    req.log.error({ err }, err.message);
    res.code(500).send({ statusCode: 500, error: 'Internal Server Error' });
  });

  app.get('/health', (req, res) => {
    res.type('application/health+json');
    if (isTerminating) {
      res.status(500).send(stringifyHealthCheck({ status: 'terminating' }));
    } else {
      res.send(stringifyHealthCheck({ status: 'ok' }));
    }
  });

  app.get('/liveness', (req, res) => {
    res.type('application/health+json');
    res.send(stringifyHealthCheck({ status: 'ok' }));
  });

  app.register(MercuriusGQLUpload, {
    maxFileSize: GQL_MAX_FILE_SIZE,
    maxFiles: 2,
  });

  app.register(mercurius, {
    schema,
    context:
      contextFn ?? ((request): Context => new Context(request, connection)),
    queryDepth: 10,
    subscription: getSubscriptionSettings(connection),
    // Disable GraphQL introspection in production
    graphiql: !isProd,
    validationRules: isProd ? [NoSchemaIntrospectionCustomRule] : undefined,
    errorFormatter(execution, ctx) {
      if (execution.errors?.length > 0) {
        const flatErrors = execution.errors.flatMap<GraphQLError>((error) => {
          if (error.originalError?.name === 'FastifyError') {
            return (
              (error.originalError as MercuriusError<GraphQLError>).errors ||
              error
            );
          }
          return error;
        });
        return {
          statusCode: 200,
          response: {
            data: execution.data,
            errors: flatErrors.map((error): GraphQLError => {
              const newError = error as Mutable<GraphQLError>;
              if (!error.originalError) {
                newError.extensions = {
                  code: 'GRAPHQL_VALIDATION_FAILED',
                };
              } else if (error.originalError?.name === 'EntityNotFoundError') {
                newError.message = 'Entity not found';
                newError.extensions = {
                  code: 'NOT_FOUND',
                };
              } else if (
                (error.originalError as FastifyError)?.code ===
                'MER_ERR_GQL_PERSISTED_QUERY_NOT_FOUND'
              ) {
                app.log.debug(
                  { body: ctx?.reply?.request?.body },
                  'unknown query',
                );
              } else if (error.originalError instanceof BrokenCircuitError) {
                newError.message = 'Garmr broken error';
                newError.extensions = {
                  code: 'GARMR_BROKEN_ERROR',
                };
              } else if (error.originalError instanceof ZodError) {
                newError.message = 'Validation error';
                newError.extensions = {
                  code: 'ZOD_VALIDATION_ERROR',
                  issues: error.originalError.issues,
                };
              } else if (!error.extensions?.code) {
                app.log.warn(
                  {
                    err: error.originalError,
                    body: ctx?.reply?.request?.body,
                  },
                  'unexpected graphql error',
                );
                newError.message = 'Unexpected error';
                newError.extensions = {
                  code: 'UNEXPECTED',
                };
              }
              if (isProd) {
                newError.originalError = undefined;
              }
              return newError;
            }),
          },
        };
      }
      return {
        statusCode: 200,
        response: execution,
      };
    },
    additionalRouteOptions: {
      preHandler: async (request, reply) => {
        const varyHeader = reply.getHeader('vary');
        const varyHeaders = Array.isArray(varyHeader)
          ? varyHeader
          : [varyHeader];

        if (request.headers['content-language']) {
          varyHeaders.push('content-language');
        }

        reply.header('vary', varyHeaders);
      },
    },
  });

  if (isProd) {
    app.register(MercuriusCache, {
      ttl: 10,
      policy: {
        Query: {
          searchBookmarksSuggestions: {
            extendKey: userExtendKey,
          },
          searchBookmarks: {
            extendKey: userExtendKey,
          },
          // anonymousFeed: {
          //   extendKey: userExtendKey,
          // },
          // feed: {
          //   extendKey: userExtendKey,
          // },
          sourceFeed: {
            extendKey: userExtendKey,
          },
          tagFeed: {
            extendKey: userExtendKey,
          },
          keywordFeed: {
            extendKey: userExtendKey,
          },
          searchPostSuggestions: {
            extendKey: userExtendKey,
          },
          searchPosts: {
            extendKey: userExtendKey,
          },
          authorFeed: {
            extendKey: userExtendKey,
          },
          mostUpvotedFeed: {
            extendKey: userExtendKey,
          },
          mostDiscussedFeed: {
            extendKey: userExtendKey,
          },
          randomTrendingPosts: {
            extendKey: userExtendKey,
          },
          randomSimilarPostsByTags: {
            extendKey: userExtendKey,
          },
          randomDiscussedPosts: {
            extendKey: userExtendKey,
          },
          tagsCategories: true,
          advancedSettings: {
            extendKey: trackingExtendKey,
          },
          banner: true,
          postByUrl: {
            extendKey: userExtendKey,
          },
          post: {
            extendKey: userExtendKey,
          },
          postUpvotes: true,
          searchTags: true,
          userReadingRankHistory: true,
          userReadHistory: true,
          autocompleteKeywords: {
            ttl: 3600,
          },
          autocomplete: {
            ttl: 3600,
          },
          autocompleteLocation: {
            ttl: 3600,
          },
        },
      },
    });
  }

  app.register(compatibility, { prefix: '/v1' });
  app.register(proxy, {
    upstream: 'https://www.google.com/s2/favicons',
    prefix: '/icon',
    logLevel: 'warn',
    replyOptions: {
      queryString: (search, reqUrl, req) => {
        const reqSearchParams = new URLSearchParams(
          req.query as { url: string; size: string },
        );
        const proxySearchParams = new URLSearchParams();

        proxySearchParams.set('domain', reqSearchParams.get('url') ?? '');
        proxySearchParams.set('sz', reqSearchParams.get('size') ?? '');
        return proxySearchParams.toString();
      },
    },
    preValidation: async (req: FastifyRequest, res) => {
      const { url, size } = req.query as { url: string; size: string };
      if (!url || !size) {
        res.status(400).send({ error: 'url and size are required' });
      }
    },
    preHandler: async (req, res) => {
      res.helmet({
        crossOriginResourcePolicy: {
          policy: 'cross-origin',
        },
      });
    },
  });

  const letterProxy: FastifyRegisterOptions<FastifyHttpProxyOptions> = {
    upstream:
      'https://media.daily.dev/image/upload/s--zchx8x3n--/f_auto,q_auto/v1731056371/webapp/shortcut-placeholder',
    preHandler: async (req: FastifyRequest, res: FastifyReply) => {
      res.helmet({
        crossOriginResourcePolicy: {
          policy: 'cross-origin',
        },
      });
    },
    logLevel: 'warn',
  };

  app.register(proxy, {
    prefix: 'lettericons',
    ...letterProxy,
  });
  app.register(proxy, {
    prefix: '/lettericons/:word',
    ...letterProxy,
  });

  app.register(proxy, {
    prefix: '/freyja',
    httpMethods: ['POST'],
    upstream: `${process.env.FREYJA_ORIGIN}/api`,
    preHandler: async (req: FastifyRequest, res: FastifyReply) => {
      res.helmet({
        crossOriginResourcePolicy: {
          policy: 'cross-origin',
        },
      });

      const regex = new RegExp('^/freyja/sessions/[^/]+/transition$');
      if (!regex.test(req.url)) {
        res.status(404).send();
        return;
      }
    },
    logLevel: 'warn',
  });

  app.register(routes, { prefix: '/' });

  return app;
}
