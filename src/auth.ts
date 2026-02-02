import { createHmac } from 'crypto';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { Roles } from './roles';
import { cookies } from './cookies';
import * as fs from 'fs';

const INTERNAL_AUTH_MAX_AGE_MS = 5000; // 5 seconds

const verifyInternalAuth = (header: string, secret: string): boolean => {
  const [timestamp, signature] = header.split(':');
  if (!timestamp || !signature) {
    return false;
  }

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Date.now() - ts > INTERNAL_AUTH_MAX_AGE_MS) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`public-api:${timestamp}`)
    .digest('hex');

  return signature === expectedSignature;
};

let publicKey: Buffer;
let privateKey: Buffer;

export type AccessToken = { token: string; expiresIn: Date };

interface Options {
  secret: string;
}

interface AuthPayload {
  userId: string;
  roles?: Roles[];
  isTeamMember?: boolean;
  isPlus?: boolean;
  exp: number;
}

export const verifyJwt = <T = AuthPayload>(token: string): Promise<T | null> =>
  new Promise((resolve, reject) => {
    jwt.verify(
      token,
      publicKey,
      {
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER,
      },
      (err, payload) => {
        if (err) {
          return reject(err);
        }
        return resolve(payload as T | null);
      },
    );
  });

const DEFAULT_JWT_EXPIRATION = 30 * 24 * 60 * 60 * 1000;
export const signJwt = <T>(
  payload: T,
  expiration = DEFAULT_JWT_EXPIRATION,
): Promise<AccessToken> =>
  new Promise((resolve, reject) => {
    const expiresIn = new Date(Date.now() + expiration);
    const newPayload = Object.assign(
      expiration ? { exp: expiresIn.getTime() / 1000 } : {},
      payload,
    );
    jwt.sign(
      newPayload,
      privateKey,
      {
        ...(process.env.NODE_ENV !== 'test' && { algorithm: 'RS256' }),
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER,
      },
      (err, token) => {
        if (err) {
          return reject(err);
        }
        return resolve({
          token: token as string,
          expiresIn,
        });
      },
    );
  });

export const loadAuthKeys = (): void => {
  if (process.env.NODE_ENV === 'test') {
    publicKey = Buffer.from('test');
    privateKey = Buffer.from('test');
  } else {
    publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH);
    privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH);
  }
};

const plugin = async (
  fastify: FastifyInstance,
  opts: Options,
): Promise<void> => {
  loadAuthKeys();

  fastify.decorateRequest('userId');
  fastify.decorateRequest('roles');
  fastify.decorateRequest('accessToken');
  fastify.decorateRequest('isTeamMember');
  fastify.decorateRequest('isPlus');

  // Machine-to-machine authentication
  fastify.addHook('preHandler', async (req) => {
    const authHeader = req.headers['authorization'] as string | undefined;

    // Internal service auth: only for /graphql, uses signed token
    const isInternalServiceAuth =
      authHeader?.startsWith('InternalService ') &&
      req.url === '/graphql' &&
      verifyInternalAuth(authHeader.substring(16), opts.secret);

    // Regular service auth: requires ENABLE_PRIVATE_ROUTES or public API route
    const isRegularServiceAuth =
      authHeader === `Service ${opts.secret}` &&
      process.env.ENABLE_PRIVATE_ROUTES === 'true';

    if (isInternalServiceAuth || isRegularServiceAuth) {
      req.service = true;
      if (req.headers['user-id'] && req.headers['logged-in'] === 'true') {
        req.userId = req.headers['user-id'] as string;
        req.isPlus = req.headers['is-plus'] === 'true';
        req.isTeamMember = req.headers['is-team-member'] === 'true';
        req.roles =
          ((req.headers['roles'] as string)?.split(',') as Roles[]) ?? [];
      }
    } else {
      delete req.headers['user-id'];
      delete req.headers['logged-in'];
    }
    const authCookie = req.cookies[cookies.auth.key];
    if (!req.userId && authCookie) {
      try {
        const unsigned = req.unsignCookie(authCookie);
        if (unsigned.valid) {
          const validValue = unsigned.value as string;

          const payload = await verifyJwt(validValue);
          if (payload) {
            req.userId = payload.userId;
            req.roles = payload.roles;
            req.isTeamMember = payload.isTeamMember;
            req.isPlus = !!payload.isPlus;
            req.accessToken = {
              token: validValue,
              expiresIn: new Date(payload.exp * 1000),
            };
          }
        }
      } catch (err) {
        // JWT is invalid - no need to do anything just not authorize
      }
    }
  });
};

export default fp(plugin, {
  name: 'authentication',
});
