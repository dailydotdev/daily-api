import { FastifyInstance } from 'fastify';

import notifications from './notifications';
import posts from './posts';
import publications from './publications';
import settings from './settings';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(notifications, { prefix: '/notifications' });
  fastify.register(posts, { prefix: '/posts' });
  fastify.register(publications, { prefix: '/publications' });
  fastify.register(settings, { prefix: '/settings' });
}
