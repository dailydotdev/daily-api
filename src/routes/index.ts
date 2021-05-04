import { FastifyInstance } from 'fastify';

import rss from './rss';
import redirector from './redirector';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rss, { prefix: '/rss' });
  fastify.register(redirector, { prefix: '/r' });
}
