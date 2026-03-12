import type { FastifyInstance } from 'fastify';
import { Readable } from 'node:stream';
import { getBetterAuth } from '../betterAuth';
import rateLimitPlugin from '@fastify/rate-limit';

const formatError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
  : [];
const betterAuthStateSuffix = '_ba';

const stripBetterAuthStateMarker = (url: URL): URL => {
  if (!url.pathname.includes('/auth/callback/')) {
    return url;
  }

  const state = url.searchParams.get('state');

  if (!state?.endsWith(betterAuthStateSuffix)) {
    return url;
  }

  url.searchParams.set('state', state.slice(0, -betterAuthStateSuffix.length));

  return url;
};

const betterAuthRoute = async (fastify: FastifyInstance): Promise<void> => {
  await fastify.register(rateLimitPlugin);

  fastify.route({
    method: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
    url: '/auth/*',
    config: {
      rateLimit: {
        max: 100,
        timeWindow: '15 minutes',
      },
    },
    onRequest: async (request, reply) => {
      try {
        reply.hijack();
        const url = stripBetterAuthStateMarker(
          new URL(
            request.raw.url ?? '/',
            `${request.protocol}://${request.host}`,
          ),
        );
        const body =
          request.raw.method === 'GET' || request.raw.method === 'HEAD'
            ? undefined
            : (Readable.toWeb(request.raw) as ReadableStream);
        const authRequest = new Request(url, {
          method: request.raw.method,
          headers: new Headers(request.raw.headers as unknown as HeadersInit),
          ...(body ? { body, duplex: 'half' as const } : {}),
        });
        const response = await getBetterAuth().handler(authRequest);
        const requestOrigin = request.raw.headers.origin;

        reply.raw.statusCode = response.status;
        if (
          typeof requestOrigin === 'string' &&
          trustedOrigins.includes(requestOrigin)
        ) {
          reply.raw.setHeader('access-control-allow-origin', requestOrigin);
          reply.raw.setHeader('access-control-allow-credentials', 'true');
          reply.raw.setHeader('vary', 'Origin');
        }
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'set-cookie') {
            reply.raw.setHeader(key, value);
          }
        });

        const nodeHeaders = response.headers as Headers & {
          getSetCookie?: () => string[];
        };
        const setCookies = nodeHeaders.getSetCookie?.() ?? [];
        if (setCookies.length > 0) {
          reply.raw.setHeader('set-cookie', setCookies);
        }

        if (!response.body) {
          reply.raw.end();
          return;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        reply.raw.end(buffer);
      } catch (error) {
        request.log.error(
          { err: formatError(error) },
          'BetterAuth request failed',
        );
        if (!reply.raw.headersSent) {
          reply.raw.statusCode = 500;
          reply.raw.setHeader('content-type', 'application/json');
          reply.raw.end(
            JSON.stringify({ error: 'Internal authentication error' }),
          );
        }
      }
    },
    handler: async () => undefined,
  });
};

export default betterAuthRoute;
