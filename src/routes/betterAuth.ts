import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as argon2 from 'argon2';
import { getBetterAuth, getBetterAuthPool } from '../betterAuth';
import { fetchOptions } from '../http';
import { retryFetch, HttpError } from '../integrations/retry';
import { generateVerifyCode } from '../ids';
import { ONE_MINUTE_IN_MS } from '../common/constants';

const kratosOrigin = process.env.KRATOS_ORIGIN;

const toRequestUrl = (request: FastifyRequest): URL => {
  const protocol = request.headers['x-forwarded-proto'] ?? 'http';
  const host = request.headers.host ?? 'localhost';
  return new URL(request.url, `${String(protocol)}://${host}`);
};

const toHeaders = (
  headersObj: FastifyRequest['headers'],
  contentType?: string,
): Headers => {
  const headers = new Headers();
  const skipHeaders = new Set(['content-length', 'transfer-encoding']);
  Object.entries(headersObj).forEach(([key, value]) => {
    if (!value || skipHeaders.has(key.toLowerCase())) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
      return;
    }
    headers.set(key, value);
  });

  if (contentType) {
    headers.set('content-type', contentType);
  }

  return headers;
};

const toRequestBody = (
  request: FastifyRequest,
): { body?: string; contentType?: string } => {
  if (request.body === undefined || request.body === null) {
    return {};
  }

  const incomingContentType = request.headers['content-type'] ?? '';
  const isFormEncoded = incomingContentType.includes(
    'application/x-www-form-urlencoded',
  );

  if (isFormEncoded) {
    if (typeof request.body === 'object') {
      return {
        body: new URLSearchParams(
          request.body as Record<string, string>,
        ).toString(),
      };
    }
    return { body: String(request.body) };
  }

  return {
    body: JSON.stringify(request.body),
    contentType: 'application/json',
  };
};

const copyResponseHeaders = (reply: FastifyReply, response: Response): void => {
  const nodeHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      void reply.header(key, value);
    }
  });

  const setCookies = nodeHeaders.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    void reply.header('set-cookie', setCookies);
  }
};

const buildBetterAuthRequest = (
  request: FastifyRequest,
  overrideUrl?: string,
  overrideBody?: string,
): Request => {
  const requestBody = toRequestBody(request);
  const headers = toHeaders(request.headers, requestBody.contentType);
  const url = overrideUrl ?? toRequestUrl(request).toString();
  const body = overrideBody ?? requestBody.body;
  return new Request(url, {
    method: request.method,
    headers,
    ...(body ? { body } : {}),
  });
};

const isSignInEmailPath = (request: FastifyRequest): boolean =>
  request.method === 'POST' && request.url.includes('/auth/sign-in/email');

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
  } catch (err) {
    if (err instanceof HttpError && err.statusCode === 400) {
      return { valid: false };
    }
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
    const pool = getBetterAuthPool();

    const { rows: existingAccount } = await pool.query(
      `SELECT 1 FROM ba_account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
      [userId],
    );
    if (existingAccount.length > 0) {
      return true;
    }

    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    const now = new Date().toISOString();
    const accountId = `${userId}-credential`;

    await pool.query(
      `INSERT INTO ba_account (id, "userId", "providerId", "accountId", "createdAt", "updatedAt", password)
       VALUES ($1, $2, 'credential', $3, $4, $4, $5)`,
      [accountId, userId, userId, now, hashedPassword],
    );

    return true;
  } catch {
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
      const auth = getBetterAuth();
      const session = await auth.api.getSession({
        headers: toHeaders(request.headers),
      });
      if (!session) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      const { newEmail } = request.body as { newEmail?: string };
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
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
      const pool = getBetterAuthPool();
      const { rows: existing } = await pool.query(
        'SELECT 1 FROM public."user" WHERE LOWER(email) = $1 AND id != $2 LIMIT 1',
        [normalizedEmail, session.user.id],
      );
      if (existing.length > 0) {
        return reply
          .status(400)
          .send({ error: 'This email address is already in use' });
      }
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
      request.log.debug(
        { email: normalizedEmail },
        'Email change verification code sent',
      );
      return reply.send({ status: true });
    } catch (error) {
      request.log.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Change email failed',
      );
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  });

  fastify.post('/auth/verify-change-email', async (request, reply) => {
    try {
      const auth = getBetterAuth();
      const session = await auth.api.getSession({
        headers: toHeaders(request.headers),
      });
      if (!session) {
        return reply.status(401).send({ error: 'Not authenticated' });
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
      const { rows: existing } = await pool.query(
        'SELECT 1 FROM public."user" WHERE LOWER(email) = $1 AND id != $2 LIMIT 1',
        [newEmail, session.user.id],
      );
      if (existing.length > 0) {
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
        { err: error instanceof Error ? error.message : String(error) },
        'Verify change email failed',
      );
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  });

  fastify.post('/auth/send-signup-verification', async (request, reply) => {
    try {
      const auth = getBetterAuth();
      const session = await auth.api.getSession({
        headers: toHeaders(request.headers),
      });
      if (!session) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      const pool = getBetterAuthPool();
      const identifier = `signup-verify:${session.user.id}`;
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
          JSON.stringify({ code, email: session.user.email }),
          expiresAt,
        ],
      );
      request.log.debug(
        { email: session.user.email },
        'Signup email verification code sent',
      );
      return reply.send({ status: true });
    } catch (error) {
      request.log.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Send signup verification failed',
      );
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  });

  fastify.post('/auth/verify-signup-email', async (request, reply) => {
    try {
      const auth = getBetterAuth();
      const session = await auth.api.getSession({
        headers: toHeaders(request.headers),
      });
      if (!session) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      const { code } = request.body as { code?: string };
      if (!code) {
        return reply
          .status(400)
          .send({ error: 'Verification code is required' });
      }
      const pool = getBetterAuthPool();
      const identifier = `signup-verify:${session.user.id}`;
      const { rows } = await pool.query(
        'SELECT value FROM ba_verification WHERE identifier = $1 AND "expiresAt" > NOW() LIMIT 1',
        [identifier],
      );
      if (rows.length === 0) {
        return reply
          .status(400)
          .send({ error: 'Verification code expired or not found' });
      }
      const { code: storedCode } = JSON.parse(rows[0].value as string);
      if (code !== storedCode) {
        return reply.status(400).send({ error: 'Invalid verification code' });
      }
      await pool.query(
        'UPDATE public."user" SET "emailConfirmed" = true WHERE id = $1',
        [session.user.id],
      );
      await pool.query('DELETE FROM ba_verification WHERE identifier = $1', [
        identifier,
      ]);
      return reply.send({ status: true });
    } catch (error) {
      request.log.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Verify signup email failed',
      );
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  });

  fastify.post('/auth/set-password', async (request, reply) => {
    try {
      const auth = getBetterAuth();
      const session = await auth.api.getSession({
        headers: toHeaders(request.headers),
      });
      if (!session) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      const { newPassword } = request.body as { newPassword?: string };
      if (!newPassword || newPassword.length < 6) {
        return reply
          .status(400)
          .send({ error: 'Password must be at least 6 characters' });
      }
      const pool = getBetterAuthPool();
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM ba_account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
        [session.user.id],
      );
      if (existing.length > 0) {
        return reply.status(400).send({
          error: 'Password already set',
          code: 'PASSWORD_ALREADY_SET',
        });
      }
      const hashedPassword = await argon2.hash(newPassword, {
        type: argon2.argon2id,
      });
      const now = new Date().toISOString();
      const accountId = `${session.user.id}-credential`;
      await pool.query(
        `INSERT INTO ba_account (id, "userId", "providerId", "accountId", "createdAt", "updatedAt", password)
         VALUES ($1, $2, 'credential', $3, $4, $4, $5)`,
        [accountId, session.user.id, session.user.id, now, hashedPassword],
      );
      return reply.send({ status: true });
    } catch (error) {
      request.log.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Set password failed',
      );
      return reply.status(500).send({ error: 'Internal authentication error' });
    }
  });

  const socialRedirectHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
    label: string,
  ) => {
    try {
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
        { err: error instanceof Error ? error.message : String(error) },
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

        if (isSignInEmailPath(request) && !response.ok) {
          const parsed = JSON.parse(text);
          if (parsed?.code === 'INVALID_EMAIL_OR_PASSWORD') {
            const body = request.body as { email?: string; password?: string };
            if (body?.email && body?.password) {
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
                  reply.status(retryRes.status);
                  copyResponseHeaders(reply, retryRes);
                  return reply.send(retryText || null);
                }
              }
            }
          }
        }

        reply.status(response.status);
        copyResponseHeaders(reply, response);
        return reply.send(text || null);
      } catch (error) {
        request.log.error(
          { err: error instanceof Error ? error.message : String(error) },
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
