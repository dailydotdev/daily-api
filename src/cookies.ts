import { CookieSerializeOptions } from '@fastify/cookie';
import { FastifyReply, FastifyRequest } from 'fastify';

const env = process.env.NODE_ENV;

export const cookies: {
  [key: string]: { opts: CookieSerializeOptions; key: string };
} = {
  tracking: {
    opts: {
      maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
      httpOnly: false,
      signed: false,
      secure: false,
      sameSite: 'lax',
    },
    key: 'da2',
  },
  session: {
    opts: {
      maxAge: 1000 * 60 * 30,
      httpOnly: false,
      signed: false,
      secure: false,
      sameSite: 'lax',
    },
    key: 'das',
  },
  auth: {
    opts: {
      maxAge: 1000 * 60 * 15,
      httpOnly: true,
      signed: true,
      secure: env === 'production',
      sameSite: 'lax',
    },
    key: 'da3',
  },
  kratos: {
    key: 'ory_kratos_session',
    opts: {
      signed: false,
      httpOnly: true,
      secure: env === 'production',
      sameSite: 'lax',
    },
  },
  kratosContinuity: {
    key: 'ory_kratos_continuity',
    opts: {},
  },
};

const extractDomain = (req: FastifyRequest): string => {
  const host = req.hostname.split(':')[0];
  // Localhost fix for local testing
  if (host === '127.0.0.1') return host;
  const parts = host.split('.');
  while (parts.length > 2) {
    parts.shift();
  }
  return parts.join('.');
};

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
