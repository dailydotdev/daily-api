import { FastifyInstance } from 'fastify';

import rss from './rss';
import redirector from './redirector';
import devcard from './devcard';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rss, { prefix: '/rss' });
  fastify.register(redirector, { prefix: '/r' });
  fastify.register(devcard, { prefix: '/devcard' });
}
