import type { FastifyInstance } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { getBetterAuth } from '../betterAuth';

const formatError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
const betterAuthStateSuffix = '_ba';

const toRequestBody = (request: FastifyRequest): string | undefined => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  if (typeof request.body === 'string') {
    return request.body;
  }

  return request.body ? JSON.stringify(request.body) : undefined;
};

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
  fastify.route({
    method: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
    url: '/auth/*',
    handler: async (request, reply) => {
      try {
        const url = stripBetterAuthStateMarker(
          new URL(request.url, `${request.protocol}://${request.host}`),
        );
        const body = toRequestBody(request);
        const authRequest = new Request(url, {
          method: request.method,
          headers: new Headers(request.headers as unknown as HeadersInit),
          ...(body ? { body } : {}),
        });
        const response = await getBetterAuth().handler(authRequest);
        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'set-cookie') {
            reply.header(key, value);
          }
        });

        const nodeHeaders = response.headers as Headers & {
          getSetCookie?: () => string[];
        };
        const setCookies = nodeHeaders.getSetCookie?.() ?? [];
        if (setCookies.length > 0) {
          reply.header('set-cookie', setCookies);
        }

        if (!response.body) {
          return reply.send();
        }

        return reply.send(await response.text());
      } catch (error) {
        request.log.error(
          { err: formatError(error) },
          'BetterAuth request failed',
        );
        if (!reply.sent) {
          return reply.status(500).send({
            error: 'Internal authentication error',
          });
        }
      }
    },
  });
};

export default betterAuthRoute;
