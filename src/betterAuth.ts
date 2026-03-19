import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { captcha, emailOTP } from 'better-auth/plugins';
import type { Pool } from 'pg';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { AppDataSource } from './data-source';
import { logger } from './logger';
import { triggerTypedEvent } from './common/typedPubsub';
import { sendEmail, CioTransactionalMessageTemplateId } from './common/mailing';
import { handleRegex } from './common/object';
import { validateAndTransformHandle } from './common/handles';
import { singleRedisClient } from './redis';
import { User } from './entity/user/User';
import { fetchOptions } from './http';
import { retryFetch } from './integrations/retry';
import { cookies, extractRootDomain } from './cookies';

const BETTER_AUTH_SECRET_MIN_LENGTH = 32;
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;
const kratosOrigin = process.env.KRATOS_ORIGIN;
const userExperienceLevels = [
  'LESS_THAN_1_YEAR',
  'MORE_THAN_1_YEAR',
  'MORE_THAN_2_YEARS',
  'MORE_THAN_4_YEARS',
  'MORE_THAN_6_YEARS',
  'MORE_THAN_10_YEARS',
  'NOT_ENGINEER',
] as const;
const userExperienceLevelSchema = z.enum(userExperienceLevels);
const signUpEmailPath = '/sign-up/email';
const signInEmailPath = '/sign-in/email';

type BetterAuthHookContext = {
  path?: string;
  body?: Record<string, unknown>;
};

type KratosVerifyResult = { valid: true; userId: string } | { valid: false };

const TRACKING_COOKIE_KEY = cookies.tracking.key;
const TRACKING_ID_REGEX = /^[0-9A-Za-z]{21}$/;

const isValidTrackingId = (value: string): boolean =>
  TRACKING_ID_REGEX.test(value);

const parseTrackingIdFromCookieHeader = (
  cookieHeader: string,
): string | undefined => {
  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === TRACKING_COOKIE_KEY) {
      const value = valueParts.join('=');
      if (value && isValidTrackingId(value)) {
        return value;
      }
      return undefined;
    }
  }
  return undefined;
};

type BetterAuthDbHookContext = {
  request?: Request;
  body?: Record<string, unknown>;
};

const throwBadRequest = (message: string): never => {
  throw APIError.from('BAD_REQUEST', {
    code: 'BAD_REQUEST',
    message,
  });
};

const hasCredentialAccount = async (
  pool: Pool,
  userId: string,
): Promise<boolean> => {
  const { rows } = await pool.query(
    `SELECT 1 FROM ba_account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
    [userId],
  );

  return rows.length > 0;
};

const insertCredentialAccount = async (
  pool: Pool,
  userId: string,
  hashedPassword: string,
): Promise<void> => {
  const now = new Date().toISOString();
  const accountId = `${userId}-credential`;

  await pool.query(
    `INSERT INTO ba_account (id, "userId", "providerId", "accountId", "createdAt", "updatedAt", password)
     VALUES ($1, $2, 'credential', $3, $4, $4, $5)`,
    [accountId, userId, userId, now, hashedPassword],
  );
};

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
      };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
};

const migrateKratosUserToBetterAuth = async ({
  pool,
  userId,
  password,
}: {
  pool: Pool;
  userId: string;
  password: string;
}): Promise<boolean> => {
  try {
    if (await hasCredentialAccount(pool, userId)) {
      return true;
    }

    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    await insertCredentialAccount(pool, userId, hashedPassword);
    return true;
  } catch (err) {
    logger.error(
      {
        err: err instanceof Error ? err.message : String(err),
        userId,
      },
      'Failed to migrate Kratos user to BetterAuth',
    );
    return false;
  }
};

export type BetterAuthHandler = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (options: { headers: Headers }) => Promise<{
      user: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null;
      };
      session: {
        id: string;
        userId: string;
        expiresAt: Date;
        token: string;
      };
    } | null>;
  };
};

let authInstance: BetterAuthHandler | null = null;

const getPool = (): Pool =>
  (AppDataSource.driver as unknown as { master: Pool }).master;

const getSocialRedirectUri = (provider: string): string | undefined => {
  const redirectBaseUrl = process.env.BETTER_AUTH_REDIRECT_URL;

  if (!redirectBaseUrl) {
    return undefined;
  }

  return `${redirectBaseUrl.replace(/\/$/, '')}/callback/${provider}`;
};

const normalizeSignUpUsername = async (
  body?: Record<string, unknown>,
): Promise<string> => {
  const username = body?.username;

  if (typeof username !== 'string' || username.trim().length === 0) {
    throwBadRequest('username is required');
  }

  const validUsername = username as string;

  if (!handleRegex.test(validUsername)) {
    throwBadRequest('username is invalid');
  }

  try {
    const normalizedUsername = await validateAndTransformHandle(
      validUsername,
      'username',
      AppDataSource,
    );
    const usernameExists = await AppDataSource.getRepository(User).exist({
      where: { username: normalizedUsername },
    });

    if (usernameExists) {
      throwBadRequest('username is already taken');
    }

    return normalizedUsername;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    return throwBadRequest('username is invalid');
  }
};

const validateExperienceLevel = (body?: Record<string, unknown>): void => {
  const experienceLevel = body?.experienceLevel;

  if (
    typeof experienceLevel !== 'string' ||
    !userExperienceLevelSchema.safeParse(experienceLevel).success
  ) {
    throwBadRequest('experienceLevel is invalid');
  }
};

const prepareSignUpContext = async ({
  body,
}: {
  body?: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
  const normalizedUsername = await normalizeSignUpUsername(body);
  validateExperienceLevel(body);

  return {
    ...body,
    username: normalizedUsername,
  };
};

const migrateLegacyCredentialIfNeeded = async ({
  pool,
  body,
}: {
  pool: Pool;
  body?: Record<string, unknown>;
}): Promise<void> => {
  const email = body?.email;
  const password = body?.password;

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !z.email().safeParse(email).success
  ) {
    return;
  }

  const user = await AppDataSource.getRepository(User)
    .createQueryBuilder('user')
    .select(['user.id'])
    .where('lower(user.email) = lower(:email)', { email })
    .getOne();

  if (!user || (await hasCredentialAccount(pool, user.id))) {
    return;
  }

  const kratosResult = await verifyKratosCredentials(email, password);

  if (kratosResult.valid && kratosResult.userId === user.id) {
    await migrateKratosUserToBetterAuth({
      pool,
      userId: user.id,
      password,
    });
  }
};

const cookieDomain = process.env.BETTER_AUTH_BASE_URL
  ? extractRootDomain(new URL(process.env.BETTER_AUTH_BASE_URL).hostname)
  : undefined;

const createAuth = (): BetterAuthHandler => {
  const pool = getPool();
  const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
    : [];
  const options: BetterAuthOptions = {
    database: pool,
    baseURL: process.env.BETTER_AUTH_BASE_URL || 'http://localhost:3000',
    basePath: '/auth',
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    trustedOrigins,
    secondaryStorage: {
      get: (key) => singleRedisClient.get(`ba:${key}`),
      set: (key, value, ttl) =>
        ttl
          ? singleRedisClient.set(`ba:${key}`, value, 'EX', ttl)
          : singleRedisClient.set(`ba:${key}`, value),
      delete: async (key) => {
        await singleRedisClient.del(`ba:${key}`);
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const hookContext = ctx as BetterAuthHookContext;

        if (hookContext.path === signUpEmailPath) {
          const body = await prepareSignUpContext({
            body: hookContext.body,
          });

          return {
            context: {
              body,
            },
          };
        }
        if (hookContext.path === signInEmailPath) {
          await migrateLegacyCredentialIfNeeded({
            pool,
            body: hookContext.body,
          });
        }
      }),
    },
    advanced: {
      cookiePrefix: 'daily',
      useSecureCookies: process.env.NODE_ENV === 'production',
      crossSubDomainCookies: {
        enabled: !!cookieDomain,
        domain: cookieDomain,
      },
      cookies: {
        session_token: {
          name: 'dast',
        },
      },
    },
    rateLimit: {
      storage: 'secondary-storage',
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      afterEmailVerification: async (user) => {
        try {
          await pool.query(
            `UPDATE public."user" SET "infoConfirmed" = true WHERE id = $1 AND "infoConfirmed" = false`,
            [user.id],
          );
        } catch (err) {
          logger.error(
            {
              err: err instanceof Error ? err.message : String(err),
              userId: user.id,
            },
            'Failed to set infoConfirmed after email verification',
          );
        }
      },
    },
    user: {
      modelName: 'user',
      fields: {
        emailVerified: 'emailConfirmed',
      },
      additionalFields: {
        username: {
          type: 'string',
          required: false,
          fieldName: 'username',
          validator: {
            input: z.string().regex(handleRegex),
          },
        },
        experienceLevel: {
          type: 'string',
          required: false,
          fieldName: 'experienceLevel',
          validator: {
            input: userExperienceLevelSchema,
          },
        },
      },
    },
    session: {
      modelName: 'ba_session',
      storeSessionInDatabase: true,
    },
    account: {
      modelName: 'ba_account',
      accountLinking: {
        trustedProviders: ['google', 'github', 'apple', 'facebook'],
        allowDifferentEmails: true,
      },
    },
    verification: {
      modelName: 'ba_verification',
      storeInDatabase: true,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            try {
              const hookCtx = ctx as BetterAuthDbHookContext;
              const cookieHeader =
                hookCtx?.request?.headers?.get('cookie') ?? '';
              const trackingId = parseTrackingIdFromCookieHeader(cookieHeader);
              if (trackingId) {
                return { data: { id: trackingId } };
              }
            } catch (err) {
              logger.error(
                { err: err instanceof Error ? err.message : String(err) },
                'Failed to extract tracking ID for new user',
              );
            }
          },
          after: async (user, ctx) => {
            try {
              await pool.query(
                'INSERT INTO feed (id, "userId") VALUES (gen_random_uuid(), $1) ON CONFLICT DO NOTHING',
                [user.id],
              );

              const setClauses: string[] = [
                `flags = CASE WHEN flags = '{}' THEN '{"trustScore": 1, "vordr": false}' ELSE flags END`,
              ];
              const values: string[] = [user.id];
              let paramIndex = 2;

              const hookCtx = ctx as BetterAuthDbHookContext;
              const body = hookCtx?.body;
              const addField = (column: string, value: unknown): void => {
                if (typeof value === 'string' && value.length > 0) {
                  setClauses.push(`"${column}" = $${paramIndex}`);
                  values.push(value);
                  paramIndex++;
                }
              };

              if (body) {
                addField('referralId', body.referral);
                addField('referralOrigin', body.referralOrigin);
                addField('timezone', body.timezone);
              }

              await pool.query(
                `UPDATE public."user" SET ${setClauses.join(', ')} WHERE id = $1`,
                values,
              );

              await triggerTypedEvent(logger, 'api.v1.ba-user-created', {
                userId: user.id,
              });
            } catch (err) {
              logger.error(
                {
                  err: err instanceof Error ? err.message : String(err),
                  userId: user.id,
                },
                'Failed to set up new user defaults after BA creation',
              );
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          transactional_message_id:
            CioTransactionalMessageTemplateId.AuthResetPassword,
          identifiers: { id: user.id },
          message_data: { url, name: user.name },
          to: user.email,
        });
      },
      password: {
        hash: (password: string) =>
          argon2.hash(password, { type: argon2.argon2id }),
        verify: ({ hash, password }: { hash: string; password: string }) =>
          argon2.verify(hash, password),
      },
    },
    plugins: [
      ...(turnstileSecretKey
        ? [
            captcha({
              provider: 'cloudflare-turnstile',
              secretKey: turnstileSecretKey,
              endpoints: ['/sign-up/email'],
            }),
          ]
        : []),
      emailOTP({
        sendVerificationOnSignUp: true,
        otpLength: 6,
        expiresIn: 600,
        changeEmail: {
          enabled: true,
        },
        sendVerificationOTP: async ({ email, otp, type }) => {
          await sendEmail({
            transactional_message_id:
              CioTransactionalMessageTemplateId.AuthVerificationOTP,
            identifiers: { email },
            message_data: { otp, type },
            to: email,
          });
        },
      }),
    ],
    socialProviders: {
      ...(process.env.GOOGLE_CLIENT_ID && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          redirectURI: getSocialRedirectUri('google'),
        },
      }),
      ...(process.env.GITHUB_CLIENT_ID && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
          redirectURI: getSocialRedirectUri('github'),
        },
      }),
      ...(process.env.APPLE_CLIENT_ID && {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
          appBundleIdentifier: process.env.APPLE_APP_BUNDLE_ID || undefined,
          redirectURI: getSocialRedirectUri('apple'),
        },
      }),
      ...(process.env.FACEBOOK_CLIENT_ID && {
        facebook: {
          clientId: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? '',
          redirectURI: getSocialRedirectUri('facebook'),
        },
      }),
    },
  };

  return betterAuth(options) as unknown as BetterAuthHandler;
};

export const initializeBetterAuth = (): BetterAuthHandler => {
  if (authInstance) {
    return authInstance;
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < BETTER_AUTH_SECRET_MIN_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be set and at least ${BETTER_AUTH_SECRET_MIN_LENGTH} characters`,
    );
  }

  authInstance = createAuth();
  return authInstance;
};

export const getBetterAuth = (): BetterAuthHandler => {
  if (!authInstance) {
    throw new Error(
      'BetterAuth not initialized. Call initializeBetterAuth() first.',
    );
  }
  return authInstance;
};
