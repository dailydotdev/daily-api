import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DataSource } from 'typeorm';
import fastifySwagger from '@fastify/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validatePersonalAccessToken } from '../../common/personalAccessToken';
import feedRoutes from './feed';
import postsRoutes from './posts';
import { commonSchemas } from './schemas';

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

  // AI agent skill documentation (no auth required)
  fastify.get('/skill.md', { schema: { hide: true } }, async (_, reply) => {
    reply.type('text/markdown').send(skillMd);
  });

  // Auth hook must run first to set apiUserId
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for documentation endpoints and skill.md
    if (request.url.startsWith('/docs') || request.url === '/skill.md') {
      return;
    }
    await tokenAuthHook(request, reply, con);
  });

  // Rate limiting using @fastify/rate-limit
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  await fastify.register(require('@fastify/rate-limit'), {
    max: 60,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => request.apiUserId || request.ip,
    errorResponseBuilder: () => ({
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please slow down.',
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
