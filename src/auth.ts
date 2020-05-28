import {
  FastifyInstance,
  FastifyRequest,
  DefaultQuery,
  DefaultParams,
  DefaultHeaders,
} from 'fastify';
import * as fp from 'fastify-plugin';

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
  }
}

interface Options {
  secret: string;
}

const plugin = async (
  fastify: FastifyInstance,
  opts: Options,
): Promise<void> => {
  // Machine-to-machine authentication
  fastify.addHook('preHandler', async (req) => {
    if (
      req.headers['authorization'] === `Service ${opts.secret}` &&
      req.headers['user-id'] &&
      req.headers['logged-in'] === 'true'
    ) {
      req.userId = req.headers['user-id'];
      req.premium = req.headers.premium === 'true';
    } else {
      delete req.headers['user-id'];
      delete req.headers['logged-in'];
    }
  });
};

export default fp(plugin, {
  name: 'authentication',
});
