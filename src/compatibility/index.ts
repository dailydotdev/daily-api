import { FastifyInstance } from 'fastify';

import publications from './publications';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(publications, { prefix: '/publications' });
}
