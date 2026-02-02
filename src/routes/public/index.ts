import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DataSource } from 'typeorm';
import fastifySwagger from '@fastify/swagger';
import { validatePersonalAccessToken } from '../../common/personalAccessToken';
import {
  ONE_MINUTE_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
} from '../../common/constants';
import { User } from '../../entity/user/User';
import { ioRedisPool } from '../../redis';
import { isPlusMember } from '../../paddle';
import feedRoutes from './feed';
import postsRoutes from './posts';
import { commonSchemas } from './schemas';

const RATE_LIMIT_PER_MINUTE = 60;
const DAILY_LIMIT = 1000;

interface RateLimitError {
  error: string;
  message: string;
  retryAfter?: number;
}

const createRateLimitResponse = (
  message: string,
  retryAfter?: number,
): RateLimitError => ({
  error: 'rate_limit_exceeded',
  message,
  ...(retryAfter && { retryAfter }),
});

const tokenAuthHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
  con: DataSource,
): Promise<void> => {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'Missing or invalid Authorization header. Use: Bearer <token>',
    });
  }

  const token = authHeader.substring(7);
  const result = await validatePersonalAccessToken(con, token);

  if (!result.valid) {
    return reply.status(401).send({
      error: 'invalid_token',
      message: 'Token is invalid, expired, or revoked',
    });
  }

  const user = await con.getRepository(User).findOne({
    where: { id: result.userId },
    select: ['id', 'subscriptionFlags'],
  });

  if (!isPlusMember(user?.subscriptionFlags?.cycle)) {
    return reply.status(403).send({
      error: 'plus_required',
      message: 'API access requires an active Plus subscription',
    });
  }

  request.apiUserId = result.userId;
  request.apiTokenId = result.tokenId;
  // Also set userId for GraphQL injection compatibility
  request.userId = result.userId;
  request.isPlus = true; // Already verified Plus subscription above
};

const incrementRateLimitCounter = async (
  key: string,
  ttlSeconds: number,
): Promise<number> =>
  ioRedisPool.execute(async (client) => {
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }
    return count;
  });

const perMinuteRateLimitHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.apiUserId;
  if (!userId) return;

  const minuteKey = `public-api:minute:${userId}:${Math.floor(Date.now() / 60000)}`;
  const count = await incrementRateLimitCounter(
    minuteKey,
    ONE_MINUTE_IN_SECONDS,
  );

  reply.header('X-RateLimit-Limit', RATE_LIMIT_PER_MINUTE);
  reply.header(
    'X-RateLimit-Remaining',
    Math.max(0, RATE_LIMIT_PER_MINUTE - count),
  );

  if (count > RATE_LIMIT_PER_MINUTE) {
    reply.header('Retry-After', 60);
    return reply
      .status(429)
      .send(
        createRateLimitResponse('Too many requests. Please slow down.', 60),
      );
  }
};

const dailyLimitHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.apiUserId;
  if (!userId) return;

  const dayKey = `public-api:daily:${userId}:${new Date().toISOString().split('T')[0]}`;
  const count = await incrementRateLimitCounter(dayKey, ONE_DAY_IN_SECONDS);

  if (count > DAILY_LIMIT) {
    return reply.status(429).send({
      error: 'daily_limit_exceeded',
      message: 'Daily API limit reached. Resets at midnight UTC.',
    });
  }
};

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  // Register Swagger for OpenAPI documentation
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'daily.dev Public API',
        description:
          'API for AI agents and automation to access daily.dev data. Requires a Plus subscription.',
        version: '1.0.0',
      },
      servers: [{ url: 'https://api.daily.dev/public/v1' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description:
              'Personal Access Token from https://app.daily.dev/settings/api',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  // Register common schemas
  for (const schema of Object.values(commonSchemas)) {
    fastify.addSchema(schema);
  }

  // OpenAPI documentation endpoints (no auth required)
  fastify.get('/docs/json', { schema: { hide: true } }, async () =>
    fastify.swagger(),
  );
  fastify.get('/docs/yaml', { schema: { hide: true } }, async (_, reply) => {
    reply.type('text/yaml').send(fastify.swagger({ yaml: true }));
  });

  // Auth hook must run first to set apiUserId
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for documentation endpoints
    if (request.url.startsWith('/docs')) {
      return;
    }
    await tokenAuthHook(request, reply, con);
  });

  // Rate limiting hooks run after auth (they need apiUserId)
  fastify.addHook('onRequest', perMinuteRateLimitHook);
  fastify.addHook('onRequest', dailyLimitHook);

  await fastify.register(feedRoutes, { prefix: '/feed' });
  await fastify.register(postsRoutes, { prefix: '/posts' });
}
