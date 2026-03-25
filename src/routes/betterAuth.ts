import type { FastifyInstance } from 'fastify';
import type { FastifyReply } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
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

// Heimdall fronts a shared OAuth callback URL for both Kratos and Better Auth,
// so we tag Better Auth social flows in `state` and strip the marker before BA
// validates the callback.
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

const forwardHeaders = (reply: FastifyReply, response: Response): void => {
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
};

type CallBetterAuthOptions = {
  req: FastifyRequest;
  reply?: FastifyReply;
  path?: string;
  method?: string;
  body?: string;
};

export const callBetterAuth = async ({
  req,
  reply,
  path,
  method,
  body,
}: CallBetterAuthOptions): Promise<Response> => {
  const baseUrl = new URL(req.url, `${req.protocol}://${req.host}`);
  const url = path ? new URL(path, baseUrl.origin) : baseUrl;
  const headers = fromNodeHeaders(
    req.headers as Record<string, string | string[] | undefined>,
  );

  const authRequest = new Request(stripBetterAuthStateMarker(url), {
    method: method ?? req.method,
    headers,
    ...(body ? { body } : {}),
  });

  const response = await getBetterAuth().handler(authRequest);

  if (reply) {
    forwardHeaders(reply, response);
  }

  return response;
};

const betterAuthRoute = async (fastify: FastifyInstance): Promise<void> => {
  // BetterAuth's setPassword is a server-only API (no HTTP route registered),
  // so we expose it as a custom route that delegates to auth.api.setPassword().
  fastify.route({
    method: 'POST',
    url: '/auth/set-password',
    handler: async (request, reply) => {
      try {
        const { newPassword } =
          (request.body as { newPassword?: string }) ?? {};
        if (!newPassword) {
          return reply.status(400).send({ error: 'newPassword is required' });
        }

        const headers = fromNodeHeaders(
          request.headers as Record<string, string | string[] | undefined>,
        );
        const result = await getBetterAuth().api.setPassword({
          body: { newPassword },
          headers,
        });

        return reply.send(result);
      } catch (error) {
        request.log.error(
          { err: formatError(error) },
          'BetterAuth set-password failed',
        );
        if (!reply.sent) {
          const status =
            error &&
            typeof error === 'object' &&
            'statusCode' in error &&
            typeof error.statusCode === 'number'
              ? error.statusCode
              : 500;
          const message =
            error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string'
              ? error.message
              : 'Failed to set password';
          return reply.status(status).send({ error: message });
        }
      }
    },
  });

  fastify.route({
    method: ['GET', 'POST'],
    url: '/auth/*',
    handler: async (request, reply) => {
      try {
        const body = toRequestBody(request);
        const response = await callBetterAuth({
          req: request,
          reply,
          body,
        });
        reply.status(response.status);
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
