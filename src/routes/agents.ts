import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { generateAgentMarkdownToken } from '../common/agentRegistration';
import { sendAnalyticsEvent } from '../integrations/analytics';

const trackSignupAttempt = async (req: FastifyRequest): Promise<void> => {
  try {
    await sendAnalyticsEvent([
      {
        event_name: 'agent signup',
        event_timestamp: new Date(),
        user_id: req.trackingId ?? req.ip,
        event_page: '/agents/v1/signup',
        app_platform: 'api',
        page_referrer: req.headers.referer,
        user_agent: req.headers['user-agent'],
      },
    ]);
  } catch (err) {
    req.log.error({ err }, 'failed to send agent signup analytics event');
  }
};

const handleSignup = async (
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  trackSignupAttempt(req);

  const markdownToken = generateAgentMarkdownToken();
  const signupUrl = new URL('/onboarding', process.env.COMMENTS_PREFIX);
  signupUrl.searchParams.set('agent_token', markdownToken.token);

  return reply.status(req.method === 'POST' ? 201 : 200).send({
    token: markdownToken.token,
    signupUrl: signupUrl.toString(),
    expiresAt: markdownToken.expiresAt.toISOString(),
    instructions:
      'This token is provisional: continued markdown access stops unless your human claims the account at signupUrl. Send signupUrl to your human now, then retry markdown URLs with Authorization: Bearer <token>.',
  });
};

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
    handleSignup,
  );

  fastify.get('/signup', { schema: { hide: true } }, handleSignup);
}
