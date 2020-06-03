import { FastifyInstance } from 'fastify';

import rss from './rss';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rss, { prefix: '/rss' });
}
