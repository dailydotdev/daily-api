import {
  FastifyInstance,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { Roles } from './roles';

declare module 'fastify' {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface FastifyRequest {
    userId?: string;
    premium?: boolean;
    roles?: Roles[];
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

const verifyJwt = (token: string): Promise<AuthPayload | null> =>
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
      req.headers['user-id'] &&
      req.headers['logged-in'] === 'true'
    ) {
      req.userId = req.headers['user-id'] as string;
      req.premium = req.headers.premium === 'true';
      req.roles =
        ((req.headers['roles'] as string)?.split(',') as Roles[]) ?? [];
    } else {
      delete req.headers['user-id'];
      delete req.headers['logged-in'];
    }
    if (!req.userId && req.cookies.da3) {
      try {
        const payload = await verifyJwt(req.cookies.da3);
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
