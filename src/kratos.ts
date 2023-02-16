import fetch, { RequestInit } from 'node-fetch';
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
): Promise<any> => {
  const res = await fetch(endpoint, {
    ...fetchOptions,
    ...addKratosHeaderCookies(req),
    ...opts,
  });
  if (res.status >= 300) {
    throw { statusCode: res.status, body: await res.text() };
  }
  return res.json();
};

export const clearAuthentication = async (
  req: FastifyRequest,
  res: FastifyReply,
): Promise<void> => {
  req.trackingId = await generateTrackingId();
  req.userId = undefined;
  setTrackingId(req, res, req.trackingId);
  setCookie(req, res, 'auth', undefined);
  setCookie(req, res, 'kratosContinuity', undefined);
  setCookie(req, res, 'kratos', undefined);
};

type WhoamiResponse =
  | { valid: true; userId: string; expires: Date }
  | { valid: false };

export const dispatchWhoami = async (
  req: FastifyRequest,
): Promise<WhoamiResponse> => {
  if (heimdallOrigin === 'disabled' || !req.cookies[cookies.kratos.key]) {
    return { valid: false };
  }
  try {
    const whoami = await fetchKratos(req, `${heimdallOrigin}/api/whoami`);
    if (whoami?.identity?.traits?.userId) {
      return {
        valid: true,
        userId: whoami.identity.traits.userId,
        expires: new Date(whoami.expires_at),
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
    const logoutFlow = await fetchKratos(
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
  await clearAuthentication(req, res);
  return res.status(204).send();
};
