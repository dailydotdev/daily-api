import { FastifyInstance } from 'fastify';
import intercom from './intercom';
import slack from './slack';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(intercom, { prefix: '/intercom' });
  fastify.register(slack, { prefix: '/slack' });
}
