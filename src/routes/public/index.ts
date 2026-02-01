import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DataSource } from 'typeorm';
import { validatePersonalAccessToken } from '../../common/personalAccessToken';
import { User } from '../../entity/user/User';
import { ioRedisPool } from '../../redis';
import { isPlusMember } from '../../paddle';
import feedRoutes from './feed';
import postsRoutes from './posts';

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
};

const perMinuteRateLimitHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.apiUserId;
  if (!userId) return;

  const minuteKey = `public-api:minute:${userId}:${Math.floor(Date.now() / 60000)}`;

  const count = await ioRedisPool.execute(async (client) => {
    const current = await client.incr(minuteKey);
    if (current === 1) {
      await client.expire(minuteKey, 60);
    }
    return current;
  });

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

  const count = await ioRedisPool.execute(async (client) => {
    const current = await client.incr(dayKey);
    if (current === 1) {
      await client.expire(dayKey, 86400);
    }
    return current;
  });

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
  fastify.addHook('onRequest', async (request, reply) => {
    await tokenAuthHook(request, reply, con);
  });

  fastify.addHook('onRequest', perMinuteRateLimitHook);
  fastify.addHook('onRequest', dailyLimitHook);

  await fastify.register(
    async (instance) => {
      await feedRoutes(instance, con);
    },
    { prefix: '/feed' },
  );

  await fastify.register(
    async (instance) => {
      await postsRoutes(instance, con);
    },
    { prefix: '/posts' },
  );
}
