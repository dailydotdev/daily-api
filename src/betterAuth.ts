import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { captcha, emailOTP } from 'better-auth/plugins';
import type { Pool } from 'pg';
import * as argon2 from 'argon2';
import * as bcryptjs from 'bcryptjs';
import { z } from 'zod';
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import { AppDataSource } from './data-source';
import { logger } from './logger';
import { sendEmail, CioTransactionalMessageTemplateId } from './common/mailing';
import { handleRegex } from './common/object';
import { validateAndTransformHandle } from './common/handles';
import { ONE_MONTH_IN_SECONDS, ONE_HOUR_IN_SECONDS } from './common/constants';
import { singleRedisClient } from './redis';
import { User } from './entity/user/User';
import { cookies, extractRootDomain } from './cookies';
import { getGeo } from './common/geo';
import { getUserCoresRole } from './common/user';
import { generateLongId, generateShortId } from './ids';
import { UserActionType } from './entity/user/UserAction';
import { insertOrIgnoreAction } from './schema/actions';
import { DigestPost } from './entity/posts/DigestPost';
import { DIGEST_SOURCE } from './entity/Source';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationPreferenceStatus,
  NotificationType,
} from './notifications/common';
import { addClaimableItemsToUser } from './entity/user/utils';
import { claimAnonOpportunities } from './common/opportunity/user';
import { triggerTypedEvent } from './common/typedPubsub';
import { assignIntroQuestsToUser } from './common/quest/intro';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

const getGooglePublicKey = async (kid: string) => {
  const res = await fetch(GOOGLE_CERTS_URL);
  const { keys } = (await res.json()) as {
    keys: Array<{ kid: string; alg: string }>;
  };
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) throw new Error(`JWK with kid ${kid} not found`);
  return importJWK(jwk, jwk.alg);
};

const BETTER_AUTH_SECRET_MIN_LENGTH = 32;
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;
const googleIosClientId = process.env.GOOGLE_IOS_CLIENT_ID;
const betterAuthSocialProviderEnvVars = {
  google: 'GOOGLE_CLIENT_ID',
  github: 'GITHUB_CLIENT_ID',
  apple: 'APPLE_CLIENT_ID',
  facebook: 'FACEBOOK_CLIENT_ID',
} as const;
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
export type BetterAuthSocialProvider =
  keyof typeof betterAuthSocialProviderEnvVars;
type BetterAuthHookContext = {
  path?: string;
  body?: Record<string, unknown>;
};

const TRACKING_COOKIE_KEY = cookies.tracking.key;
const TRACKING_ID_REGEX = /^[0-9A-Za-z]{21}$/;

const isValidTrackingId = (value: string): boolean =>
  TRACKING_ID_REGEX.test(value);

const parseCookieValue = (
  cookieHeader: string,
  key: string,
): string | undefined => {
  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === key) {
      const value = decodeURIComponent(valueParts.join('='));
      return value || undefined;
    }
  }
  return undefined;
};

const JOIN_REFERRAL_COOKIE_KEY = 'join_referral';

const parseTrackingIdFromCookieHeader = (
  cookieHeader: string,
): string | undefined => {
  const value = parseCookieValue(cookieHeader, TRACKING_COOKIE_KEY);
  if (value && isValidTrackingId(value)) {
    return value;
  }
  return undefined;
};

const parseReferralFromCookieHeader = (
  cookieHeader: string,
): { referralId: string; referralOrigin: string } | undefined => {
  const value = parseCookieValue(cookieHeader, JOIN_REFERRAL_COOKIE_KEY);
  if (!value) {
    return undefined;
  }
  const [referralId, referralOrigin] = value.split(':');
  if (referralId && referralOrigin) {
    return { referralId, referralOrigin };
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

const getUsernameValidationMessage = (error: unknown): string | undefined => {
  if (!(error instanceof Error)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(error.message) as { username?: string };

    if (parsed.username === 'username is too short') {
      return parsed.username;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const isBcryptHash = (hash: string): boolean =>
  hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');

const rehashBcryptToArgon2 = async (
  pool: Pool,
  oldBcryptHash: string,
  newArgon2Hash: string,
): Promise<void> => {
  const { rowCount } = await pool.query(
    `UPDATE ba_account SET password = $1, "updatedAt" = NOW() WHERE password = $2 AND "providerId" = 'credential'`,
    [newArgon2Hash, oldBcryptHash],
  );
  if (rowCount && rowCount > 0) {
    logger.info('Rehashed BCrypt password to Argon2id on login');
  }
};

export const verifyPasswordWithBcryptFallback = async ({
  hash,
  password,
  pool,
}: {
  hash: string;
  password: string;
  pool?: Pool;
}): Promise<boolean> => {
  if (isBcryptHash(hash)) {
    const valid = bcryptjs.compareSync(password, hash);
    if (valid && pool) {
      try {
        const argon2Hash = await argon2.hash(password, {
          type: argon2.argon2id,
        });
        await rehashBcryptToArgon2(pool, hash, argon2Hash);
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Failed to rehash BCrypt password to Argon2id',
        );
      }
    }
    return valid;
  }

  return argon2.verify(hash, password);
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
    setPassword: (options: {
      body: { newPassword: string };
      headers: Headers;
    }) => Promise<{ status: boolean }>;
  };
};

let authInstance: BetterAuthHandler | null = null;

const getPool = (): Pool =>
  (AppDataSource.driver as unknown as { master: Pool }).master;

export const betterAuthSocialProviders = Object.keys(
  betterAuthSocialProviderEnvVars,
) as BetterAuthSocialProvider[];

const normalizeSignUpUsername = async (
  body?: Record<string, unknown>,
): Promise<string> => {
  const username = body?.username;

  if (typeof username !== 'string' || username.trim().length === 0) {
    throwBadRequest('username is required');
  }

  const validUsername = username as string;

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

    return throwBadRequest(
      getUsernameValidationMessage(error) ?? 'username is invalid',
    );
  }
};

const validateExperienceLevel = (body?: Record<string, unknown>): void => {
  const experienceLevel = body?.experienceLevel;

  // will be allowed in v2 onboarding
  if (!experienceLevel) {
    return;
  }

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

const cookieDomain = process.env.BETTER_AUTH_BASE_URL
  ? extractRootDomain(new URL(process.env.BETTER_AUTH_BASE_URL).hostname)
  : undefined;

const MAX_DELETED_USER_COLLISION_RETRIES = 3;

const ensureNonDeletedUserId = async (
  pool: Pool,
  candidate: string,
): Promise<string> => {
  let id = candidate;
  for (let i = 0; i < MAX_DELETED_USER_COLLISION_RETRIES; i++) {
    const { rowCount } = await pool.query(
      'SELECT id FROM public."deleted_user" WHERE id = $1',
      [id],
    );
    if (!rowCount) {
      return id;
    }
    id = await generateLongId();
  }
  throw new Error(
    `Failed to generate non-deleted user id after ${MAX_DELETED_USER_COLLISION_RETRIES} retries`,
  );
};

const resolveSignUpUserId = async (
  pool: Pool,
  user: { email: string },
  ctx: unknown,
): Promise<{ data: { id: string } }> => {
  try {
    const hookCtx = ctx as BetterAuthDbHookContext;
    const cookieHeader = hookCtx?.request?.headers?.get('cookie') ?? '';
    const trackingId = parseTrackingIdFromCookieHeader(cookieHeader);
    if (trackingId) {
      const existing = await pool.query<{ email: string }>(
        'SELECT email FROM public."user" WHERE id = $1',
        [trackingId],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        const existingEmail = existing.rows[0].email;

        logger.warn(
          {
            trackingId,
            sameEmail: existingEmail === user.email,
          },
          'Tracking cookie ID collision: cookie holds an existing user ID during signup',
        );

        if (existingEmail !== user.email) {
          // user has stale tracking cookie generate new user
          // is to safely insert since its a new email
          // in latter stage better auth logic will correlate
          // with existing credential if it exists for email
          return { data: { id: await generateLongId() } };
        }
      }
      return { data: { id: trackingId } };
    }
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'Failed to extract tracking ID for new user',
    );
  }

  return { data: { id: await generateLongId() } };
};

export const getBetterAuthOptions = (pool: Pool): BetterAuthOptions => {
  const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
    : [];

  return {
    database: pool,
    baseURL: process.env.BETTER_AUTH_BASE_URL || 'http://localhost:3000',
    basePath: '/auth',
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    trustedOrigins,
    onAPIError: {
      errorURL: `${process.env.COMMENTS_PREFIX}/callback`,
    },
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
        state: {
          attributes: {
            // Better Auth's DB-backed OAuth state cookie defaults to 5 minutes,
            // while the verification record lives for 10 minutes. Keep them in
            // sync so slower provider flows do not fail the cookie check first.
            maxAge: 10 * 60,
          },
        },
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
      expiresIn: ONE_MONTH_IN_SECONDS,
      updateAge: 12 * ONE_HOUR_IN_SECONDS,
    },
    account: {
      modelName: 'ba_account',
      accountLinking: {
        trustedProviders: betterAuthSocialProviders,
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
            const resolved = await resolveSignUpUserId(pool, user, ctx);
            resolved.data.id = await ensureNonDeletedUserId(
              pool,
              resolved.data.id,
            );
            return resolved;
          },
          after: async (user, ctx) => {
            try {
              await pool.query(
                'INSERT INTO feed (id, "userId") VALUES ($1, $1) ON CONFLICT DO NOTHING',
                [user.id],
              );

              const setClauses: string[] = [
                `flags = CASE WHEN flags = '{}' THEN '{"trustScore": 1, "vordr": false}' ELSE flags END`,
              ];
              const values: unknown[] = [user.id];
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

              const cookieHeader =
                hookCtx?.request?.headers?.get('cookie') ?? '';
              const cookieReferral =
                parseReferralFromCookieHeader(cookieHeader);
              const oauthState = await getOAuthState();

              addField(
                'referralId',
                body?.referral ?? cookieReferral?.referralId,
              );
              addField(
                'referralOrigin',
                body?.referralOrigin ?? cookieReferral?.referralOrigin,
              );
              addField('timezone', body?.timezone ?? oauthState?.timezone);

              if (typeof body?.acceptedMarketing === 'boolean') {
                setClauses.push(`"acceptedMarketing" = $${paramIndex}`);
                values.push(body.acceptedMarketing);
                paramIndex++;
              }

              const notificationFlags =
                body?.acceptedMarketing === false
                  ? {
                      ...DEFAULT_NOTIFICATION_SETTINGS,
                      [NotificationType.Marketing]: {
                        email: NotificationPreferenceStatus.Muted,
                        inApp: NotificationPreferenceStatus.Muted,
                      },
                    }
                  : DEFAULT_NOTIFICATION_SETTINGS;
              setClauses.push(`"notificationFlags" = $${paramIndex}`);
              values.push(notificationFlags);
              paramIndex++;

              const ip =
                hookCtx?.request?.headers
                  ?.get('x-forwarded-for')
                  ?.split(',')[0]
                  ?.trim() ?? '';
              if (ip) {
                const region = getGeo({ ip }).country;
                const coresRole = getUserCoresRole({ region });
                setClauses.push(`"coresRole" = $${paramIndex}`);
                values.push(String(coresRole));
                paramIndex++;

                await insertOrIgnoreAction(
                  AppDataSource.manager,
                  user.id,
                  UserActionType.CheckedCoresRole,
                );
              }

              await pool.query(
                `UPDATE public."user" SET ${setClauses.join(', ')} WHERE id = $1`,
                values,
              );

              const digestPostId = await generateShortId();
              await AppDataSource.getRepository(DigestPost)
                .createQueryBuilder()
                .insert()
                .values({
                  id: digestPostId,
                  shortId: digestPostId,
                  authorId: user.id,
                  private: true,
                  visible: false,
                  sourceId: DIGEST_SOURCE,
                })
                .orIgnore()
                .execute();

              try {
                await addClaimableItemsToUser(AppDataSource, {
                  id: user.id,
                  email: user.email,
                });
              } catch (err) {
                logger.error(
                  {
                    err: err instanceof Error ? err.message : String(err),
                    userId: user.id,
                  },
                  'Failed to add claimable items for new BA user',
                );
              }

              try {
                await assignIntroQuestsToUser({
                  con: AppDataSource.manager,
                  userId: user.id,
                });
              } catch (err) {
                logger.error(
                  {
                    err: err instanceof Error ? err.message : String(err),
                    userId: user.id,
                  },
                  'Failed to assign intro quests for new BA user',
                );
              }

              try {
                for (const identifier of [user.id, user.email].filter(
                  Boolean,
                )) {
                  await claimAnonOpportunities({
                    anonUserId: identifier,
                    userId: user.id,
                    con: AppDataSource.manager,
                  });
                }
              } catch (err) {
                logger.error(
                  {
                    err: err instanceof Error ? err.message : String(err),
                    userId: user.id,
                  },
                  'Failed to claim anonymous opportunities for new BA user',
                );
              }
            } catch (err) {
              logger.error(
                {
                  err: err instanceof Error ? err.message : String(err),
                  userId: user.id,
                },
                'Failed to set up new user defaults after BA creation',
              );
            }

            await triggerTypedEvent(logger, 'api.v1.ba-user-created', {
              userId: user.id,
            });
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
          send_to_unsubscribed: true,
        });
      },
      password: {
        hash: (password: string) =>
          argon2.hash(password, { type: argon2.argon2id }),
        verify: ({ hash, password }: { hash: string; password: string }) =>
          verifyPasswordWithBcryptFallback({ hash, password, pool }),
      },
    },
    plugins: [
      ...(turnstileSecretKey
        ? [
            captcha({
              provider: 'cloudflare-turnstile',
              secretKey: turnstileSecretKey,
              endpoints: ['/sign-up/email', '/sign-in/email'],
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
            send_to_unsubscribed: true,
          });
        },
      }),
    ],
    socialProviders: {
      ...(process.env.GOOGLE_CLIENT_ID && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          ...(googleIosClientId && {
            verifyIdToken: async (token: string, nonce?: string) => {
              try {
                const { kid, alg: jwtAlg } = decodeProtectedHeader(token);
                if (!kid || !jwtAlg) return false;

                const publicKey = await getGooglePublicKey(kid);
                const { payload: jwtClaims } = await jwtVerify(
                  token,
                  publicKey,
                  {
                    algorithms: [jwtAlg],
                    issuer: [
                      'https://accounts.google.com',
                      'accounts.google.com',
                    ],
                    audience: [
                      process.env.GOOGLE_CLIENT_ID!,
                      googleIosClientId,
                    ],
                    maxTokenAge: '1h',
                  },
                );

                if (nonce && jwtClaims.nonce !== nonce) return false;
                return true;
              } catch {
                return false;
              }
            },
          }),
        },
      }),
      ...(process.env.GITHUB_CLIENT_ID && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
          disableDefaultScope: true,
          scope: ['user:email'],
        },
      }),
      ...(process.env.APPLE_CLIENT_ID && {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
          appBundleIdentifier: process.env.APPLE_APP_BUNDLE_ID || undefined,
        },
      }),
      ...(process.env.FACEBOOK_CLIENT_ID && {
        facebook: {
          clientId: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? '',
        },
      }),
    },
  };
};

const createAuth = (): BetterAuthHandler =>
  betterAuth(getBetterAuthOptions(getPool())) as unknown as BetterAuthHandler;

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
