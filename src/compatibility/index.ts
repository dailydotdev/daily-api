import { FastifyInstance } from 'fastify';

import notifications from './notifications';
import publications from './publications';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(notifications, { prefix: '/notifications' });
  fastify.register(publications, { prefix: '/publications' });
}
