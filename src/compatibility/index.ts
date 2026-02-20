import { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';

import publications from './publications';

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  fastify.register(
    async (instance) => {
      await publications(instance, con);
    },
    { prefix: '/publications' },
  );
}
