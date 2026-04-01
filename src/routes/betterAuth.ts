import type { FastifyInstance } from 'fastify';
import type { FastifyReply } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { getBetterAuth } from '../betterAuth';

const formatError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
const internalAuthenticationError = 'Internal authentication error';

/** Auth paths where failed responses should be logged with full detail. */
const MONITORED_AUTH_PATHS = [
  '/auth/sign-up/email',
  '/auth/sign-in/email',
  '/auth/sign-in/social',
];

const isMonitoredPath = (url: string): boolean =>
  MONITORED_AUTH_PATHS.some((p) => url.includes(p));

/**
 * Safely extract a JSON body from a request string without exposing secrets.
 * Strips password and token fields.
 */
const sanitizeBody = (raw: string | undefined): Record<string, unknown> | undefined => {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sanitized = { ...parsed };
    delete sanitized.password;
    delete sanitized.turnstileToken;
    delete sanitized['x-captcha-response'];
    delete sanitized.idToken;
    delete sanitized.token;
    return sanitized;
  } catch {
    return undefined;
  }
};

/**
 * Parse a Better Auth error response body. Returns the parsed object or
 * undefined when the body cannot be read (e.g. stream already consumed).
 */
const parseBetterAuthErrorBody = async (
  response: Response,
): Promise<Record<string, unknown> | undefined> => {
  try {
    const text = await response.clone().text();
    if (!text) {
      return undefined;
    }
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

/**
 * Log detailed context when Better Auth returns an error response for a
 * monitored endpoint (sign-up, sign-in). This is critical for diagnosing
 * opaque errors like "Failed to create user" where the underlying cause
 * is swallowed by the auth library.
 */
const logBetterAuthErrorResponse = async (
  request: FastifyRequest,
  response: Response,
  requestBody: string | undefined,
): Promise<void> => {
  const errorBody = await parseBetterAuthErrorBody(response);

  request.log.warn(
    {
      betterAuth: {
        status: response.status,
        errorBody,
        requestPath: request.url,
        requestMethod: request.method,
        requestBodySanitized: sanitizeBody(requestBody),
        ip:
          request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ??
          request.ip,
        userAgent: request.headers['user-agent'],
      },
    },
    `BetterAuth error response ${response.status} on ${request.url}`,
  );
};

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
  // Apple sends OAuth callbacks as application/x-www-form-urlencoded POSTs.
  // Fastify does not parse this content type by default, so collect the raw
  // body and let BetterAuth handle it.
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, body);
    },
  );

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

        // Log detailed context for error responses on monitored auth paths
        if (response.status >= 400 && isMonitoredPath(request.url)) {
          await logBetterAuthErrorResponse(request, response, body);
        }

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
