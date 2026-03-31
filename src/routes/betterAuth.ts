import type { FastifyInstance } from 'fastify';
import type { FastifyReply } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { getBetterAuth } from '../betterAuth';

const formatError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
const internalAuthenticationError = 'Internal authentication error';

const toRequestBody = (request: FastifyRequest): string | undefined => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  if (typeof request.body === 'string') {
    return request.body;
  }

  return request.body ? JSON.stringify(request.body) : undefined;
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

const sendBetterAuthResponse = async (
  reply: FastifyReply,
  response: Response,
): Promise<FastifyReply> => {
  reply.status(response.status);

  if (!response.body) {
    return reply.send();
  }

  return reply.send(await response.text());
};

const sendBetterAuthError = (
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  message: string,
): FastifyReply | void => {
  request.log.error({ err: formatError(error) }, message);

  if (!reply.sent) {
    return reply.status(500).send({
      error: internalAuthenticationError,
    });
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

  const authRequest = new Request(url, {
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

export const logoutBetterAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    await callBetterAuth({
      req: request,
      reply,
      path: '/auth/sign-out',
      method: 'POST',
    });
  } catch (error) {
    request.log.warn(
      { err: formatError(error) },
      'error during BetterAuth sign-out',
    );
  }
};

const betterAuthRoute = async (fastify: FastifyInstance): Promise<void> => {
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
        return sendBetterAuthResponse(reply, response);
      } catch (error) {
        return sendBetterAuthError(
          request,
          reply,
          error,
          'BetterAuth request failed',
        );
      }
    },
  });
};

export default betterAuthRoute;
