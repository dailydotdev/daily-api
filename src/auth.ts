import {
  FastifyInstance,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { Roles } from './roles';
import { cookies } from './cookies';

declare module 'fastify' {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface FastifyRequest {
    userId?: string;
    premium?: boolean;
    roles?: Roles[];
    service?: boolean;
  }

  /* eslint-enable @typescript-eslint/no-unused-vars */
}

interface Options {
  secret: string;
}

interface AuthPayload {
  userId: string;
  premium: boolean;
  roles?: Roles[];
}

export type AccessToken = { token: string; expiresIn: Date };

export const verifyJwt = (token: string): Promise<AuthPayload | null> =>
  new Promise((resolve, reject) => {
    jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER,
      },
      (err, payload) => {
        if (err) {
          return reject(err);
        }
        return resolve(payload as AuthPayload | null);
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
      process.env.JWT_SECRET,
      {
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER,
      },
      (err, token) => {
        if (err) {
          return reject(err);
        }
        return resolve({
          token,
          expiresIn,
        });
      },
    );
  });

const plugin = async (
  fastify: FastifyInstance,
  opts: Options,
): Promise<void> => {
  fastify.decorateRequest('userId', null);
  fastify.decorateRequest('premium', null);
  fastify.decorateRequest('roles', null);
  // Machine-to-machine authentication
  fastify.addHook('preHandler', async (req) => {
    if (
      req.headers['authorization'] === `Service ${opts.secret}` &&
      process.env.ENABLE_PRIVATE_ROUTES === 'true'
    ) {
      req.service = true;
      if (req.headers['user-id'] && req.headers['logged-in'] === 'true') {
        req.userId = req.headers['user-id'] as string;
        req.premium = req.headers.premium === 'true';
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
        const payload = await verifyJwt(
          unsigned.valid ? unsigned.value : authCookie,
        );
        if (payload) {
          req.userId = payload.userId;
          req.premium = payload.premium;
          req.roles = payload.roles;
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
