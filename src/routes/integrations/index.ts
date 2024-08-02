import { FastifyInstance } from 'fastify';
import slack from './slack';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(slack, { prefix: '/slack' });
}
