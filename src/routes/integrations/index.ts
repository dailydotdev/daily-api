import { FastifyInstance } from 'fastify';
import github from './github';
import intercom from './intercom';
import onboarding from './onboarding';
import slack from './slack';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(github, { prefix: '/github' });
  fastify.register(intercom, { prefix: '/intercom' });
  fastify.register(onboarding, { prefix: '/onboarding' });
  fastify.register(slack, { prefix: '/slack' });
}
