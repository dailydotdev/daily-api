import type { RequestInit } from 'undici';
import { addDays } from 'date-fns';
import { fetchOptions } from './http';
import { FastifyReply, FastifyRequest } from 'fastify';
import { cookies, setCookie } from './cookies';
import { setTrackingId } from './tracking';
import { generateTrackingId } from './ids';
import { HttpError, retryFetch } from './integrations/retry';
import { LogoutReason } from './common';
import { counters } from './telemetry';

const heimdallOrigin = process.env.HEIMDALL_ORIGIN;
const kratosOrigin = process.env.KRATOS_ORIGIN;

const addKratosHeaderCookies = (req: FastifyRequest): RequestInit => ({
  headers: {
    cookie: req.headers.cookie as string,
    forwarded: req.headers.forwarded as string,
  },
});

class KratosError extends Error {
  statusCode: number;
  body: string;

  constructor(statusCode: number, body: string) {
    super(`Kratos error: ${statusCode}`);
    this.statusCode = statusCode;
    this.body = body;
  }
}

const fetchKratos = async (
  req: FastifyRequest,
  endpoint: string,
  opts: RequestInit = {},
  parseResponse = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ res: any; headers: Headers }> => {
  try {
    const res = await retryFetch(endpoint, {
      ...fetchOptions,
      ...addKratosHeaderCookies(req),
      ...opts,
    });
    return {
      res: parseResponse ? await res.json() : null,
      headers: res.headers,
    };
  } catch (err) {
    if (err instanceof HttpError) {
      const kratosError = new KratosError(err.statusCode, err.response);
      if (err.statusCode >= 500) {
        req.log.warn({ err: kratosError }, 'unexpected error from kratos');
      }
      if (err.statusCode !== 303 && err.statusCode !== 401) {
        req.log.info({ err: kratosError }, 'non-401 error from kratos');
      }
      throw err;
    }
    throw err;
  }
};

export const clearAuthentication = async (
  req: FastifyRequest,
  res: FastifyReply,
  reason: string,
): Promise<void> => {
  req.log.info(
    {
      reason,
      userId: req.userId,
      cookie: req.cookies[cookies.kratos.key],
    },
    'clearing authentication',
  );
  req.trackingId = await generateTrackingId(req, 'clear authentication');
  req.userId = undefined;
  setTrackingId(req, res, req.trackingId);
  setCookie(req, res, 'auth', undefined);
  setCookie(req, res, 'kratosContinuity', undefined);
  setCookie(req, res, 'kratos', undefined);

  counters?.api?.clearAuthentication?.add(1, { reason });
};

const MOCK_USER_ID = process.env.MOCK_USER_ID;

type WhoamiResponse =
  | {
      valid: true;
      userId: string;
      expires: Date;
      cookie?: string;
      verified: boolean;
      email?: string;
    }
  | { valid: false };

export const dispatchWhoami = async (
  req: FastifyRequest,
): Promise<WhoamiResponse> => {
  if (MOCK_USER_ID) {
    const expires = addDays(new Date(), 1);

    return Promise.resolve({
      valid: true,
      userId: MOCK_USER_ID,
      expires,
      verified: true,
    });
  }

  if (heimdallOrigin === 'disabled' || !req.cookies[cookies.kratos.key]) {
    return { valid: false };
  }
  try {
    const { res: whoami, headers } = await fetchKratos(
      req,
      `${heimdallOrigin}/api/whoami`,
    );

    // To support both legacy and new whoami responses
    let session, verified: boolean;
    if (whoami.hasOwnProperty('session')) {
      session = whoami.session;
      verified = whoami.verified;
    } else {
      session = whoami;
      verified = true;
    }

    if (session?.identity?.traits?.userId) {
      return {
        verified,
        valid: true,
        userId: session.identity.traits.userId,
        expires: new Date(session.expires_at),
        cookie: headers.get('set-cookie') || undefined,
        email: session.identity.traits.email,
      };
    }
    req.log.info({ whoami }, 'invalid whoami response');
  } catch (originalError) {
    const e = originalError as HttpError;

    if (e.statusCode !== 401) {
      throw e;
    }
  }

  return { valid: false };
};

export const logout = async (
  req: FastifyRequest,
  res: FastifyReply,
  isDeletion = false,
): Promise<FastifyReply> => {
  const query = req.query as { reason?: LogoutReason };
  const queryReason = query?.reason as LogoutReason;
  const reason = Object.values(LogoutReason).includes(queryReason)
    ? queryReason
    : LogoutReason.ManualLogout;

  try {
    const { res: logoutFlow } = await fetchKratos(
      req,
      `${kratosOrigin}/self-service/logout/browser`,
    );
    if (logoutFlow?.logout_url) {
      const logoutParts = logoutFlow.logout_url.split('/self-service/');
      const logoutUrl = `${kratosOrigin}/self-service/${logoutParts[1]}`;
      await fetchKratos(req, logoutUrl, { redirect: 'manual' }, false);
    }
  } catch (originalError) {
    const e = originalError as HttpError;

    if (e.statusCode !== 303 && e.statusCode !== 401) {
      req.log.warn({ err: e }, 'unexpected error while logging out');
    }
  }

  await clearAuthentication(
    req,
    res,
    isDeletion ? LogoutReason.UserDeleted : reason,
  );
  return res.status(204).send();
};
