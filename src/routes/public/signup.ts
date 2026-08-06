import type { FastifyInstance, FastifyRequest } from 'fastify';
import { logger } from '../../logger';

const SIGNUP_URL = 'https://app.daily.dev/onboarding';
const TOKEN_URL = 'https://app.daily.dev/settings/api';
const RETRY_AFTER_SECONDS = 3600;

const unavailableResponse = {
  error: 'service_unavailable',
  message:
    'Signup is temporarily unavailable. No account was created and your password was not stored. Please try again shortly — or create the account at https://app.daily.dev/onboarding and generate a Personal Access Token at https://app.daily.dev/settings/api.',
  signupUrl: SIGNUP_URL,
  tokenUrl: TOKEN_URL,
  retryAfter: RETRY_AFTER_SECONDS,
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
  //
  // The shared logger rather than `req.log`: Fastify's per-request child
  // does not inherit a spy installed on the app logger, so `req.log` can
  // never be asserted on in a test.
  logger.info(
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
        summary: 'Create a daily.dev account',
        description:
          'Creates a daily.dev account from an email and password. No token required — this is the endpoint to call when you do not have one yet. Personal Access Tokens for the rest of this API are issued separately from account settings.',
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
          503: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              signupUrl: { type: 'string', description: 'Web signup flow' },
              tokenUrl: {
                type: 'string',
                description: 'Where an account owner mints an API token',
              },
              retryAfter: {
                type: 'number',
                description: 'Seconds to wait before retrying',
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      logAttempt({ req });

      return reply
        .status(503)
        .header('retry-after', RETRY_AFTER_SECONDS)
        .send(unavailableResponse);
    },
  );

  // Agents probe before they post. Answering the GET with the same
  // payload keeps the discovery attempt in the same log stream instead
  // of losing it to a bare 404.
  fastify.get('/', { schema: { hide: true } }, async (req, reply) => {
    logAttempt({ req });

    return reply
      .status(503)
      .header('retry-after', RETRY_AFTER_SECONDS)
      .send(unavailableResponse);
  });
}
