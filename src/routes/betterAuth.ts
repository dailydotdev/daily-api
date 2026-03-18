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

export const forwardBetterAuthHeaders = (
  reply: FastifyReply,
  response: Response,
): void => {
  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });
};

const sendBetterAuthResponse = async (
  reply: FastifyReply,
  response: Response,
): Promise<FastifyReply> => {
  reply.status(response.status);
  forwardBetterAuthHeaders(reply, response);

  if (!response.body) {
    return reply.send();
  }

  return reply.send(await response.text());
};

type CallBetterAuthOptions = {
  req: FastifyRequest;
  path?: string;
  method?: string;
  body?: string;
};

export const callBetterAuth = async ({
  req,
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

  return getBetterAuth().handler(authRequest);
};

const betterAuthRoute = async (fastify: FastifyInstance): Promise<void> => {
  fastify.route({
    method: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
    url: '/auth/*',
    handler: async (request, reply) => {
      try {
        const body = toRequestBody(request);
        const response = await callBetterAuth({
          req: request,
          body,
        });
        return sendBetterAuthResponse(reply, response);
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
