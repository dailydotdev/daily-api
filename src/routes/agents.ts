import type { FastifyInstance } from 'fastify';
import { generateAgentMarkdownToken } from '../common/agentRegistration';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/signup',
    {
      schema: {
        hide: true,
        response: {
          201: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              signupUrl: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              instructions: { type: 'string' },
            },
            required: ['token', 'signupUrl', 'expiresAt', 'instructions'],
          },
        },
      },
    },
    async (_, reply) => {
      const markdownToken = generateAgentMarkdownToken();
      const signupUrl = new URL('/onboarding', process.env.COMMENTS_PREFIX);
      signupUrl.searchParams.set('agent_token', markdownToken.token);

      return reply.status(201).send({
        token: markdownToken.token,
        signupUrl: signupUrl.toString(),
        expiresAt: markdownToken.expiresAt.toISOString(),
        instructions:
          'Retry markdown URLs with Authorization: Bearer <token>, then immediately send signupUrl to your human and ask them to claim the account.',
      });
    },
  );
}
