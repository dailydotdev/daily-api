import {
  FastifyInstance,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import { cookies } from './config';

declare module 'fastify' {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface FastifyRequest {
    trackingId?: string;
  }

  /* eslint-enable @typescript-eslint/no-unused-vars */
}

const plugin = async (fastify: FastifyInstance): Promise<void> => {
  fastify.decorateRequest('trackingId', null);

  fastify.addHook('preHandler', async (req) => {
    if (req.userId) {
      req.trackingId = req.userId;
    } else if (req.cookies[cookies.tracking.key]) {
      req.trackingId = req.cookies[cookies.tracking.key];
    }
  });
};

export default fp(plugin, {
  name: 'tracking',
});
