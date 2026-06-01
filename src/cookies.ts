import { CookieSerializeOptions } from '@fastify/cookie';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ONE_MONTH_IN_SECONDS } from './common/constants';
import { generateTrackingId } from './ids';
import { setTrackingId } from './tracking';
import { counters } from './telemetry';

const env = process.env.NODE_ENV;

export const cookies: {
  [key: string]: { opts: CookieSerializeOptions; key: string };
} = {
  tracking: {
    opts: {
      maxAge: 60 * 60 * 24 * 365 * 10,
      httpOnly: false,
      signed: false,
      secure: false,
      sameSite: 'lax',
    },
    key: 'da2',
  },
  session: {
    opts: {
      maxAge: 60 * 30,
      httpOnly: false,
      signed: false,
      secure: false,
      sameSite: 'lax',
    },
    key: 'das',
  },
  auth: {
    opts: {
      maxAge: 60 * 15,
      httpOnly: true,
      signed: true,
      secure: env === 'production',
      sameSite: 'lax',
    },
    key: 'da3',
  },
  funnel: {
    opts: {
      maxAge: 60 * 30,
      httpOnly: true,
      signed: false,
      secure: env === 'production',
      sameSite: 'lax',
    },
    key: 'da4',
  },
  onboarding: {
    opts: {
      maxAge: 60 * 30,
      httpOnly: true,
      signed: false,
      secure: env === 'production',
      sameSite: 'lax',
    },
    key: 'da5',
  },
  authSession: {
    key: env === 'production' ? '__Secure-dast' : 'dast',
    opts: {
      maxAge: ONE_MONTH_IN_SECONDS,
      signed: false,
      httpOnly: true,
      secure: env === 'production',
      sameSite: 'lax',
    },
  },
};

export const extractRootDomain = (hostname: string): string => {
  const host = hostname.split(':')[0];
  if (host === '127.0.0.1') return host;
  const parts = host.split('.');
  while (parts.length > 2) {
    parts.shift();
  }
  return parts.join('.');
};

const extractDomain = (req: FastifyRequest): string =>
  extractRootDomain(req.hostname);

const addSubdomainOpts = (
  req: FastifyRequest,
  opts: CookieSerializeOptions,
): CookieSerializeOptions => {
  const domain = extractDomain(req);
  return {
    ...opts,
    domain,
  };
};

export const setRawCookie = (
  res: FastifyReply,
  setCookieValue: string,
): FastifyReply => {
  let setCookie = res.getHeader('Set-Cookie');
  if (!setCookie) {
    res.header('Set-Cookie', setCookieValue);
    return res;
  }

  if (typeof setCookie === 'string') {
    setCookie = [setCookie];
  }
  if (typeof setCookie !== 'number') {
    setCookie.push(setCookieValue);
  }
  res.removeHeader('Set-Cookie');
  return res.header('Set-Cookie', setCookie);
};

export const setCookie = (
  req: FastifyRequest,
  res: FastifyReply,
  key: string,
  value: string | undefined,
  opts: Partial<CookieSerializeOptions> = {},
): FastifyReply => {
  const config = cookies[key];
  const mergedOpts: CookieSerializeOptions = {
    path: '/',
    ...addSubdomainOpts(req, config.opts),
    ...opts,
  };
  if (!value) {
    return res.clearCookie(config.key, mergedOpts);
  }
  return res.cookie(config.key, value, mergedOpts);
};

const clearCookieByName = (
  req: FastifyRequest,
  res: FastifyReply,
  key: string,
  opts: Partial<CookieSerializeOptions> = {},
): FastifyReply =>
  res.clearCookie(key, {
    path: '/',
    ...addSubdomainOpts(req, {}),
    ...opts,
  });

export const clearAuthentication = async (
  req: FastifyRequest,
  res: FastifyReply,
  reason: string,
): Promise<void> => {
  req.log.info(
    {
      reason,
      userId: req.userId,
    },
    'clearing authentication',
  );
  req.trackingId = await generateTrackingId(req, 'clear authentication');
  req.userId = undefined;
  setTrackingId(req, res, req.trackingId);
  setCookie(req, res, 'auth', undefined);
  setCookie(req, res, 'authSession', undefined);
  clearCookieByName(req, res, 'ory_kratos_session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: env === 'production',
  });
  clearCookieByName(req, res, 'ory_kratos_continuity');

  counters?.api?.clearAuthentication?.add(1, { reason });
};
