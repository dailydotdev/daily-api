import { FastifyInstance } from 'fastify';

import notifications from './notifications';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(notifications, { prefix: '/notifications' });
}
