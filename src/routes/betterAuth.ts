import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as argon2 from 'argon2';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { getBetterAuth, getBetterAuthPool } from '../betterAuth';
import { fetchOptions } from '../http';
import { retryFetch } from '../integrations/retry';
import { generateVerifyCode } from '../ids';
import { ONE_MINUTE_IN_MS } from '../common/constants';
import { singleRedisClient } from '../redis';
import { logger } from '../logger';
import {
  sendEmail,
  CioTransactionalMessageTemplateId,
} from '../common/mailing';
import {
  getClientIp,
  toHeaders,
  toRequestUrl,
  buildBetterAuthRequest,
  copyResponseHeaders,
} from '../common/betterAuth';

const kratosOrigin = process.env.KRATOS_ORIGIN;
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;

const authRateLimiter = new RateLimiterRedis({
  storeClient: singleRedisClient,
  points: 10,
  duration: 60,
  keyPrefix: 'ba-auth',
});

const strictAuthRateLimiter = new RateLimiterRedis({
  storeClient: singleRedisClient,
  points: 5,
  duration: 300,
  keyPrefix: 'ba-auth-strict',
});

const formatError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const enforceRateLimit = async (
  request: FastifyRequest,
  reply: FastifyReply,
  limiter: RateLimiterRedis = strictAuthRateLimiter,
): Promise<boolean> => {
  try {
    await limiter.consume(getClientIp(request));
    return true;
  } catch {
    reply
      .status(429)
      .send({ error: 'Too many requests, please try again later' });
    return false;
  }
};

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

const verifyTurnstileToken = async (
  token: string,
  ip?: string,
): Promise<boolean> => {
  if (!turnstileSecretKey) {
    return true;
  }

  try {
    const body = new URLSearchParams({
      secret: turnstileSecretKey,
      response: token,
    });
    if (ip) {
      body.set('remoteip', ip);
    }

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    const data = (await res.json()) as TurnstileVerifyResponse;
    return data.success === true;
  } catch {
    return false;
  }
};

const isSignUpEmailPath = (request: FastifyRequest): boolean =>
  request.method === 'POST' && request.url.includes('/auth/sign-up/email');

const isSignInEmailPath = (request: FastifyRequest): boolean =>
  request.method === 'POST' && request.url.includes('/auth/sign-in/email');

const requireSession = async (request: FastifyRequest, reply: FastifyReply) => {
  const auth = getBetterAuth();
  const session = await auth.api.getSession({
    headers: toHeaders(request.headers),
  });
  if (!session) {
    reply.status(401).send({ error: 'Not authenticated' });
    return null;
  }
  return session;
};

const isEmailTaken = async (
  email: string,
  excludeUserId: string,
): Promise<boolean> => {
  const pool = getBetterAuthPool();
  const { rows } = await pool.query(
    'SELECT 1 FROM public."user" WHERE LOWER(email) = $1 AND id != $2 LIMIT 1',
    [email, excludeUserId],
  );
  return rows.length > 0;
};

const hasCredentialAccount = async (userId: string): Promise<boolean> => {
  const pool = getBetterAuthPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM ba_account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
};

const insertCredentialAccount = async (
  userId: string,
  hashedPassword: string,
): Promise<void> => {
  const pool = getBetterAuthPool();
  const now = new Date().toISOString();
  const accountId = `${userId}-credential`;
  await pool.query(
    `INSERT INTO ba_account (id, "userId", "providerId", "accountId", "createdAt", "updatedAt", password)
     VALUES ($1, $2, 'credential', $3, $4, $4, $5)`,
    [accountId, userId, userId, now, hashedPassword],
  );
};

const sendBetterAuthResponse = (
  reply: FastifyReply,
  response: Response,
  text: string,
) => {
  reply.status(response.status);
  copyResponseHeaders(reply, response);
  return reply.send(text || null);
};

type KratosVerifyResult =
  | { valid: true; userId: string; name?: string }
  | { valid: false };

const verifyKratosCredentials = async (
  email: string,
  password: string,
): Promise<KratosVerifyResult> => {
  if (!kratosOrigin) {
    return { valid: false };
  }

  try {
    const flowRes = await retryFetch(
      `${kratosOrigin}/self-service/login/api`,
      fetchOptions,
    );
    const flow = await flowRes.json();
    const flowId = flow.id;

    const submitRes = await retryFetch(
      `${kratosOrigin}/self-service/login?flow=${flowId}`,
      {
        ...fetchOptions,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'password',
          identifier: email,
          password,
        }),
      },
    );
    const result = await submitRes.json();
    const traits = result?.session?.identity?.traits;
    if (traits?.userId) {
      return {
        valid: true,
        userId: traits.userId,
        name: traits.name,
      };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
};

const migrateKratosUserToBetterAuth = async ({
  userId,
  password,
}: {
  userId: string;
  password: string;
}): Promise<boolean> => {
  try {
    if (await hasCredentialAccount(userId)) {
      return true;
    }

    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    await insertCredentialAccount(userId, hashedPassword);
    return true;
  } catch (err) {
    logger.error(
      { err: formatError(err), userId },
      'Failed to migrate Kratos user to BetterAuth',
    );
    return false;
  }
};

const betterAuthRoute = async (fastify: FastifyInstance): Promise<void> => {
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    },
  );

  fastify.get('/auth/check-email', async (request, reply) => {
    if (!(await enforceRateLimit(request, reply, authRateLimiter))) {
      return reply;
    }
    const { email } = request.query as { email: string };
    if (!email) {
      return reply.status(400).send({ error: 'email is required' });
    }
    const pool = getBetterAuthPool();
    const { rows } = await pool.query(
      'SELECT 1 FROM public."user" WHERE email = $1 LIMIT 1',
      [email],
    );
    return reply.send({ result: rows.length > 0 });
  });

  fastify.post('/auth/change-email', async (request, reply) => {
    try {
      if (!(await enforceRateLimit(request, reply))) {
        return reply;
      }
      const session = await requireSession(request, reply);
      if (!session) {
        return reply;
      }
      const { newEmail } = request.body as { newEmail?: string };
      if (
        !newEmail ||
        newEmail.length > 254 ||
        newEmail.indexOf('@') <= 0 ||
        newEmail.lastIndexOf('@') !== newEmail.indexOf('@') ||
        newEmail.lastIndexOf('.') <= newEmail.indexOf('@') + 1
      ) {
        return reply
          .status(400)
          .send({ error: 'A valid email address is required' });
      }
      const normalizedEmail = newEmail.toLowerCase();
      if (normalizedEmail === session.user.email?.toLowerCase()) {
        return reply
          .status(400)
          .send({ error: 'New email is the same as current email' });
      }
      if (await isEmailTaken(normalizedEmail, session.user.id)) {
        return reply
          .status(400)
          .send({ error: 'This email address is already in use' });
      }
      const pool = getBetterAuthPool();
      const identifier = `change-email:${session.user.id}`;
      await pool.query('DELETE FROM ba_verification WHERE identifier = $1', [
        identifier,
      ]);
      const code = await generateVerifyCode();
      const expiresAt = new Date(Date.now() + 10 * ONE_MINUTE_IN_MS);
      await pool.query(
        `INSERT INTO ba_verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
        [
          identifier,
          JSON.stringify({ code, newEmail: normalizedEmail }),
          expiresAt,
        ],
      );
      await sendEmail({
        transactional_message_id:
          CioTransactionalMessageTemplateId.AuthVerificationOTP,
        identifiers: { id: session.user.id },
        message_data: { otp: code, type: 'change-email' },
        to: normalizedEmail,
      });
      return reply.send({ status: true });
    } catch (error) {
      request.log.error({ err: formatError(error) }, 'Change email failed');
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  });

  fastify.post('/auth/verify-change-email', async (request, reply) => {
    try {
      if (!(await enforceRateLimit(request, reply))) {
        return reply;
      }
      const session = await requireSession(request, reply);
      if (!session) {
        return reply;
      }
      const { code } = request.body as { code?: string };
      if (!code) {
        return reply
          .status(400)
          .send({ error: 'Verification code is required' });
      }
      const pool = getBetterAuthPool();
      const identifier = `change-email:${session.user.id}`;
      const { rows } = await pool.query(
        'SELECT value FROM ba_verification WHERE identifier = $1 AND "expiresAt" > NOW() LIMIT 1',
        [identifier],
      );
      if (rows.length === 0) {
        return reply
          .status(400)
          .send({ error: 'Verification code expired or not found' });
      }
      const { code: storedCode, newEmail } = JSON.parse(
        rows[0].value as string,
      );
      if (code !== storedCode) {
        return reply.status(400).send({ error: 'Invalid verification code' });
      }
      if (await isEmailTaken(newEmail, session.user.id)) {
        return reply
          .status(400)
          .send({ error: 'This email address is already in use' });
      }
      await pool.query('UPDATE public."user" SET email = $1 WHERE id = $2', [
        newEmail,
        session.user.id,
      ]);
      await pool.query('DELETE FROM ba_verification WHERE identifier = $1', [
        identifier,
      ]);
      return reply.send({ status: true });
    } catch (error) {
      request.log.error(
        { err: formatError(error) },
        'Verify change email failed',
      );
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  });

  fastify.post('/auth/set-password', async (request, reply) => {
    try {
      if (!(await enforceRateLimit(request, reply))) {
        return reply;
      }
      const session = await requireSession(request, reply);
      if (!session) {
        return reply;
      }
      const { newPassword } = request.body as { newPassword?: string };
      if (!newPassword || newPassword.length < 8) {
        return reply
          .status(400)
          .send({ error: 'Password must be at least 8 characters' });
      }
      if (await hasCredentialAccount(session.user.id)) {
        return reply.status(400).send({
          error: 'Password already set',
          code: 'PASSWORD_ALREADY_SET',
        });
      }
      const hashedPassword = await argon2.hash(newPassword, {
        type: argon2.argon2id,
      });
      await insertCredentialAccount(session.user.id, hashedPassword);
      return reply.send({ status: true });
    } catch (error) {
      request.log.error({ err: formatError(error) }, 'Set password failed');
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  });

  const socialRedirectHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
    label: string,
  ) => {
    try {
      if (!(await enforceRateLimit(request, reply, authRateLimiter))) {
        return reply;
      }
      const { provider, callbackURL } = request.query as {
        provider?: string;
        callbackURL?: string;
      };
      if (!provider) {
        return reply.status(400).send({ error: 'provider is required' });
      }
      const auth = getBetterAuth();
      const url = toRequestUrl(request);
      const headers = toHeaders(request.headers, 'application/json');
      const postReq = new Request(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider, callbackURL }),
      });
      const response = await auth.handler(postReq);
      copyResponseHeaders(reply, response);
      const location = response.headers.get('location');
      if (location) {
        const authUrl = new URL(location);
        const state = authUrl.searchParams.get('state');
        if (state) {
          authUrl.searchParams.set('state', state + '_ba');
        }
        return reply.redirect(authUrl.toString(), 302);
      }
      reply.status(response.status);
      const text = await response.text();
      return reply.send(text || null);
    } catch (error) {
      request.log.error(
        { err: formatError(error) },
        `BetterAuth ${label} failed`,
      );
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  };

  fastify.get('/auth/sign-in/social', async (request, reply) =>
    socialRedirectHandler(request, reply, 'social sign-in redirect'),
  );

  fastify.get('/auth/link-social', async (request, reply) =>
    socialRedirectHandler(request, reply, 'social link redirect'),
  );

  fastify.route({
    method: ['GET', 'POST'],
    url: '/auth/*',
    handler: async (request, reply) => {
      try {
        const limiter = isSignUpEmailPath(request)
          ? strictAuthRateLimiter
          : authRateLimiter;
        if (!(await enforceRateLimit(request, reply, limiter))) {
          return reply;
        }

        if (isSignUpEmailPath(request)) {
          const turnstileToken = request.headers['x-turnstile-token'] as
            | string
            | undefined;
          if (turnstileSecretKey && !turnstileToken) {
            return reply
              .status(400)
              .send({ error: 'Turnstile verification failed' });
          }
          if (turnstileToken) {
            const clientIp = getClientIp(request);
            const valid = await verifyTurnstileToken(turnstileToken, clientIp);
            if (!valid) {
              return reply
                .status(400)
                .send({ error: 'Turnstile verification failed' });
            }
          }
        }

        const auth = getBetterAuth();
        let overrideUrl: string | undefined;
        if (request.url.includes('/auth/callback/')) {
          const url = toRequestUrl(request);
          const state = url.searchParams.get('state');
          if (state?.endsWith('_ba')) {
            url.searchParams.set('state', state.slice(0, -3));
            overrideUrl = url.toString();
          }
        }

        const req = buildBetterAuthRequest(request, overrideUrl);
        const response = await auth.handler(req);
        const text = await response.text();

        if (isSignUpEmailPath(request) && response.ok) {
          const username = request.headers['x-profile-username'] as
            | string
            | undefined;
          const experienceLevel = request.headers[
            'x-profile-experience-level'
          ] as string | undefined;
          if (username || experienceLevel) {
            try {
              const parsed = JSON.parse(text);
              const userId = parsed?.user?.id;
              if (userId) {
                const pool = getBetterAuthPool();
                const setClauses: string[] = [];
                const values: (string | boolean)[] = [];
                let paramIndex = 1;

                if (username) {
                  setClauses.push(`username = $${paramIndex++}`);
                  values.push(username);
                }
                if (experienceLevel) {
                  setClauses.push(`"experienceLevel" = $${paramIndex++}`);
                  values.push(experienceLevel);
                }

                values.push(userId);
                await pool.query(
                  `UPDATE public."user" SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
                  values,
                );
              }
            } catch (err) {
              logger.error(
                { err: formatError(err) },
                'Failed to save profile data after BA sign-up',
              );
            }
          }
        }

        if (request.url.includes('/email-otp/verify-email') && response.ok) {
          try {
            const body = request.body as Record<string, unknown>;
            const email =
              typeof body?.email === 'string' ? body.email.toLowerCase() : '';
            if (email) {
              const pool = getBetterAuthPool();
              await pool.query(
                `UPDATE public."user" SET "infoConfirmed" = true WHERE LOWER(email) = $1 AND "infoConfirmed" = false`,
                [email],
              );
            }
          } catch (err) {
            logger.error(
              { err: formatError(err) },
              'Failed to set infoConfirmed after OTP verification',
            );
          }
        }

        if (isSignInEmailPath(request) && !response.ok) {
          const parsed = JSON.parse(text);
          if (parsed?.code === 'INVALID_EMAIL_OR_PASSWORD') {
            const body = request.body as { email?: string; password?: string };
            if (body?.email && body?.password) {
              const retryLimiter = isSignUpEmailPath(request)
                ? strictAuthRateLimiter
                : authRateLimiter;
              if (!(await enforceRateLimit(request, reply, retryLimiter))) {
                return reply;
              }

              const kratosResult = await verifyKratosCredentials(
                body.email,
                body.password,
              );
              if (kratosResult.valid) {
                const migrated = await migrateKratosUserToBetterAuth({
                  userId: kratosResult.userId,
                  password: body.password,
                });
                if (migrated) {
                  const retryReq = buildBetterAuthRequest(request);
                  const retryRes = await auth.handler(retryReq);
                  const retryText = await retryRes.text();
                  return sendBetterAuthResponse(reply, retryRes, retryText);
                }
              }
            }
          }
        }

        return sendBetterAuthResponse(reply, response, text);
      } catch (error) {
        request.log.error(
          { err: formatError(error) },
          'BetterAuth request failed',
        );
        return reply
          .status(500)
          .send({ error: 'Internal authentication error' });
      }
    },
  });
};

export default betterAuthRoute;
