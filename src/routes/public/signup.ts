import type { FastifyInstance, FastifyRequest } from 'fastify';

const SIGNUP_URL = 'https://app.daily.dev/onboarding';
const TOKEN_URL = 'https://app.daily.dev/settings/api';

const notImplementedResponse = {
  error: 'not_implemented',
  message:
    'Programmatic signup is not available yet. No account was created and the password you sent was discarded, not stored. Check back soon — in the meantime create an account at https://app.daily.dev/onboarding and a Personal Access Token at https://app.daily.dev/settings/api.',
  signupUrl: SIGNUP_URL,
  tokenUrl: TOKEN_URL,
};

type SignupBody = {
  email?: string;
  password?: string;
  name?: string;
  username?: string;
};

const logAttempt = ({ req }: { req: FastifyRequest }): void => {
  const body = (req.body ?? {}) as SignupBody;
  const password = typeof body.password === 'string' ? body.password : null;

  // `info` on a non-error path is deliberate: the log line is the entire
  // product of this endpoint. It measures whether agents that read
  // llms.txt actually attempt a programmatic signup, and which ones.
  req.log.info(
    {
      event: 'agent_signup_attempt',
      method: req.method,
      email: typeof body.email === 'string' ? body.email : null,
      // Never log the plaintext. Length and presence answer "did an agent
      // mint a credential?" without putting a possibly-real password into
      // a log sink that is retained and broadly readable.
      passwordProvided: password !== null,
      passwordLength: password?.length ?? 0,
      bodyKeys: Object.keys(body),
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip,
      referer: req.headers.referer ?? null,
      origin: req.headers.origin ?? null,
      contentType: req.headers['content-type'] ?? null,
      validationError: req.validationError?.message ?? null,
    },
    'agent signup attempt',
  );
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: SignupBody }>(
    '/',
    {
      // Log malformed attempts too — what an agent gets wrong is as much
      // of a signal as what it gets right, and Fastify would otherwise
      // reject on schema violations before the handler runs.
      attachValidation: true,
      schema: {
        summary: 'Sign up for a daily.dev account',
        description:
          'Agent-friendly signup. Not implemented yet: every request answers 501 and no account is created. Published so agents have a documented place to ask for one, and so we can measure the demand. The password is never stored.',
        tags: ['signup'],
        security: [],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address for the new account',
            },
            password: {
              type: 'string',
              minLength: 8,
              description:
                'Password for the new account. Discarded on receipt — never logged or stored.',
            },
            name: { type: 'string', description: 'Display name (optional)' },
            username: { type: 'string', description: 'Handle (optional)' },
          },
        },
        response: {
          501: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              signupUrl: {
                type: 'string',
                description: 'Where a human can create the account instead',
              },
              tokenUrl: {
                type: 'string',
                description: 'Where that human can then mint an API token',
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      logAttempt({ req });

      return reply.status(501).send(notImplementedResponse);
    },
  );

  // Agents probe before they post. Answering the GET with the same
  // payload keeps the discovery attempt in the same log stream instead
  // of losing it to a bare 404.
  fastify.get('/', { schema: { hide: true } }, async (req, reply) => {
    logAttempt({ req });

    return reply.status(501).send(notImplementedResponse);
  });
}
