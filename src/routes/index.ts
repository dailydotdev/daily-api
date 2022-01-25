import { FastifyInstance } from 'fastify';

import rss from './rss';
import settings from './settings';
import redirector from './redirector';
import devcards from './devcards';
import privateRoutes from './private';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rss, { prefix: '/rss' });
  fastify.register(settings, { prefix: '/settings' });
  fastify.register(redirector, { prefix: '/r' });
  fastify.register(devcards, { prefix: '/devcards' });
  fastify.register(privateRoutes, { prefix: '/p' });
}
