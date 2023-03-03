import { FastifyInstance } from 'fastify';

import feeds from './feeds';
import posts from './posts';
import publications from './publications';
import settings from './settings';
import tags from './tags';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(feeds, { prefix: '/feeds' });
  fastify.register(posts, { prefix: '/posts' });
  fastify.register(publications, { prefix: '/publications' });
  fastify.register(settings, { prefix: '/settings' });
  fastify.register(tags, { prefix: '/tags' });
}
