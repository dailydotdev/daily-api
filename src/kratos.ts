import fetch, { RequestInit, Headers } from 'node-fetch';
import { fetchOptions } from './http';
import { FastifyReply, FastifyRequest } from 'fastify';
import { cookies, setCookie } from './cookies';
import { setTrackingId } from './tracking';
import { generateTrackingId } from './ids';

const heimdallOrigin = process.env.HEIMDALL_ORIGIN;
const kratosOrigin = process.env.KRATOS_ORIGIN;

const addKratosHeaderCookies = (req: FastifyRequest): RequestInit => ({
  headers: {
    cookie: req.headers.cookie,
    forwarded: req.headers.forwarded,
  },
});

const fetchKratos = async (
  req: FastifyRequest,
  endpoint: string,
  opts: RequestInit = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ res: any; headers: Headers }> => {
  const res = await fetch(endpoint, {
    ...fetchOptions,
    ...addKratosHeaderCookies(req),
    ...opts,
  });
  if (res.status >= 300) {
    throw { statusCode: res.status, body: await res.text() };
  }
  return { res: await res.json(), headers: res.headers };
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
  req.trackingId = await generateTrackingId();
  req.userId = undefined;
  setTrackingId(req, res, req.trackingId);
  setCookie(req, res, 'auth', undefined);
  setCookie(req, res, 'kratosContinuity', undefined);
  setCookie(req, res, 'kratos', undefined);
};

type WhoamiResponse =
  | { valid: true; userId: string; expires: Date; cookie?: string }
  | { valid: false };

export const dispatchWhoami = async (
  req: FastifyRequest,
): Promise<WhoamiResponse> => {
  if (heimdallOrigin === 'disabled' || !req.cookies[cookies.kratos.key]) {
    return { valid: false };
  }
  try {
    const { res: whoami, headers } = await fetchKratos(
      req,
      `${heimdallOrigin}/api/whoami`,
    );
    if (whoami?.identity?.traits?.userId) {
      return {
        valid: true,
        userId: whoami.identity.traits.userId,
        expires: new Date(whoami.expires_at),
        cookie: headers.get('set-cookie'),
      };
    }
  } catch (e) {
    if (e.statusCode !== 401) {
      throw e;
    }
  }

  return { valid: false };
};

export const logout = async (
  req: FastifyRequest,
  res: FastifyReply,
): Promise<FastifyReply> => {
  try {
    const { res: logoutFlow } = await fetchKratos(
      req,
      `${kratosOrigin}/self-service/logout/browser`,
    );
    if (logoutFlow?.logout_url) {
      const logoutParts = logoutFlow.logout_url.split('/self-service/');
      const logoutUrl = `${kratosOrigin}/self-service/${logoutParts[1]}`;
      await fetchKratos(req, logoutUrl, { redirect: 'manual' });
    }
  } catch (e) {
    if (e.statusCode !== 303 && e.statusCode !== 401) {
      throw e;
    }
  }
  await clearAuthentication(req, res, 'manual logout');
  return res.status(204).send();
};
