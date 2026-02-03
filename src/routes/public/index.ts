import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DataSource } from 'typeorm';
import fastifySwagger from '@fastify/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validatePersonalAccessToken } from '../../common/personalAccessToken';
import feedRoutes from './feed';
import postsRoutes from './posts';
import { commonSchemas } from './schemas';
import { PUBLIC_API_PREFIX } from '../../common/constants';

export { PUBLIC_API_PREFIX };
const USER_RATE_LIMIT_PER_MINUTE = 60;
const IP_RATE_LIMIT_PER_MINUTE = 300;
const PUBLIC_API_BASE_URL = `https://api.daily.dev${PUBLIC_API_PREFIX}`;

const skillMd = readFileSync(join(__dirname, 'skill.md'), 'utf-8');

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

  // Note: Plus subscription is validated when creating tokens and tokens are
  // revoked when Plus is cancelled, so no need to check Plus status here
  request.apiUserId = result.userId;
  request.apiTokenId = result.tokenId;
  // Also set userId for GraphQL injection compatibility
  request.userId = result.userId;
  request.isPlus = true;
};

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  // Decorate fastify with the database connection for route handlers
  fastify.decorate('con', con);

  // Register Swagger for OpenAPI documentation
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'daily.dev Public API',
        description:
          'API for AI agents and automation to access daily.dev data. Requires a Plus subscription.',
        version: '1.0.0',
      },
      servers: [{ url: PUBLIC_API_BASE_URL }],
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

  // AI agent skill documentation (no auth required)
  fastify.get('/skill.md', { schema: { hide: true } }, async (_, reply) => {
    reply.type('text/markdown').send(skillMd);
  });

  // IP rate limiting MUST be registered before auth to prevent DoS via token validation flooding
  // This is intentionally generous - the real API limit is per-user after auth
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  await fastify.register(require('@fastify/rate-limit'), {
    max: IP_RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => request.ip,
    errorResponseBuilder: () => ({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP. Please slow down.',
      retryAfter: 60,
    }),
    skipOnError: false,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': false,
      'x-ratelimit-remaining': false,
      'x-ratelimit-reset': false,
    },
    addHeaders: {
      'x-ratelimit-limit': false,
      'x-ratelimit-remaining': false,
      'x-ratelimit-reset': false,
      'retry-after': true,
    },
  });

  // Auth hook runs after IP rate limiting
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for documentation endpoints and skill.md
    // request.url includes the full path with prefix
    if (
      request.url.startsWith(`${PUBLIC_API_PREFIX}/docs`) ||
      request.url === `${PUBLIC_API_PREFIX}/skill.md`
    ) {
      return;
    }
    await tokenAuthHook(request, reply, con);
  });

  // Per-user rate limiting runs on preHandler (after auth sets apiUserId)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  await fastify.register(require('@fastify/rate-limit'), {
    max: USER_RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    hook: 'preHandler',
    keyGenerator: (request: FastifyRequest) => request.apiUserId,
    skip: (request: FastifyRequest) => !request.apiUserId,
    errorResponseBuilder: () => ({
      error: 'rate_limit_exceeded',
      message: 'User rate limit exceeded. Please slow down.',
      retryAfter: 60,
    }),
    skipOnError: false,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  await fastify.register(feedRoutes, { prefix: '/feed' });
  await fastify.register(postsRoutes, { prefix: '/posts' });
}
