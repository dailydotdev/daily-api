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

const isOAuthCallbackPath = (url: string): boolean =>
  /\/auth\/callback\//.test(url);

const oauthProviderPattern = /\/auth\/callback\/([^/?]+)/;

export type OAuthErrorRewrite = {
  url: string;
  provider?: string;
  error?: string;
  errorDescription?: string;
  state?: string;
};

export const rewriteOAuthErrorRedirect = (
  request: FastifyRequest,
  response: Response,
): OAuthErrorRewrite | undefined => {
  if (!isOAuthCallbackPath(request.url)) {
    return undefined;
  }

  if (response.status < 300 || response.status >= 400) {
    return undefined;
  }

  const location = response.headers.get('location');
  if (!location) {
    return undefined;
  }

  const webappCallback = `${process.env.COMMENTS_PREFIX}/callback`;
  if (!webappCallback) {
    return undefined;
  }

  if (location.startsWith(webappCallback)) {
    return undefined;
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(location, `${request.protocol}://${request.host}`);
  } catch {
    return undefined;
  }

  const hasError =
    redirectUrl.searchParams.has('error') ||
    redirectUrl.searchParams.get('state') === 'state_not_found';
  if (!hasError) {
    return undefined;
  }

  const callbackUrl = new URL(webappCallback);
  redirectUrl.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value);
  });

  return {
    url: callbackUrl.toString(),
    provider: request.url.match(oauthProviderPattern)?.[1],
    error: redirectUrl.searchParams.get('error') ?? undefined,
    errorDescription:
      redirectUrl.searchParams.get('error_description') ?? undefined,
    state: redirectUrl.searchParams.get('state') ?? undefined,
  };
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

        const rewrite = rewriteOAuthErrorRedirect(request, response);
        if (rewrite) {
          request.log.warn(
            {
              provider: rewrite.provider,
              error: rewrite.error,
              errorDescription: rewrite.errorDescription,
              state: rewrite.state,
              userId: request.userId || request.trackingId,
              originalLocation: response.headers.get('location'),
            },
            'OAuth callback error redirect rewritten to webapp',
          );
          reply.header('location', rewrite.url);
          reply.status(302);
          return reply.send();
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
