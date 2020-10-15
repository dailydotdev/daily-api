import {
  FastifyInstance,
  FastifyRequest,
  DefaultQuery,
  DefaultParams,
  DefaultHeaders,
} from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { Roles } from './roles';

declare module 'fastify' {
  interface FastifyRequest<
    HttpRequest,
    Query = DefaultQuery,
    Params = DefaultParams,
    Headers = DefaultHeaders,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Body = any
  > {
    userId?: string;
    premium?: boolean;
    roles?: Roles[];
  }
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
      req.userId = req.headers['user-id'];
      req.premium = req.headers.premium === 'true';
      req.roles = req.headers['roles']?.split(',') ?? [];
    } else {
      delete req.headers['user-id'];
      delete req.headers['logged-in'];
    }
    if (!req.userId && req.cookies.da3) {
      const payload = await verifyJwt(req.cookies.da3);
      if (payload) {
        req.userId = payload.userId;
        req.premium = payload.premium;
        req.roles = payload.roles;
      }
    }
  });
};

export default fp(plugin, {
  name: 'authentication',
});
