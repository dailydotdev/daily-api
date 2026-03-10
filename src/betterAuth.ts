import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { logger } from './logger';

const BETTER_AUTH_SECRET_MIN_LENGTH = 32;

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
let poolInstance: Pool | null = null;

const createPool = () => {
  if (!process.env.TYPEORM_HOST && process.env.NODE_ENV === 'production') {
    throw new Error('TYPEORM_HOST must be set in production');
  }
  return new Pool({
    host: process.env.TYPEORM_HOST || 'localhost',
    port: 5432,
    user: process.env.TYPEORM_USERNAME || 'postgres',
    password: process.env.TYPEORM_PASSWORD,
    database:
      process.env.TYPEORM_DATABASE ||
      (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
    max: 10,
  });
};

const createAuth = (): BetterAuthHandler => {
  poolInstance = createPool();
  const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
    : [];
  const redirectURL = process.env.BETTER_AUTH_REDIRECT_URL;
  const oauthPaths = ['/sign-in/social', '/callback/', '/link-social'];
  const options: BetterAuthOptions = {
    database: poolInstance,
    baseURL: process.env.BETTER_AUTH_BASE_URL || 'http://localhost:3000',
    basePath: '/a/auth',
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    trustedOrigins,
    ...(redirectURL && {
      hooks: {
        before: createAuthMiddleware(async (ctx) => {
          if (oauthPaths.some((p) => ctx.path?.startsWith(p))) {
            return { context: { context: { baseURL: redirectURL } } };
          }
        }),
      },
    }),
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
    user: {
      modelName: 'user',
      fields: {
        emailVerified: 'emailConfirmed',
      },
    },
    session: {
      modelName: 'ba_session',
    },
    account: {
      modelName: 'ba_account',
      accountLinking: {
        trustedProviders: ['google', 'github', 'apple', 'facebook'],
      },
    },
    verification: {
      modelName: 'ba_verification',
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              if (!poolInstance) {
                return;
              }
              await poolInstance.query(
                'INSERT INTO feed (id, "userId") VALUES (gen_random_uuid(), $1) ON CONFLICT DO NOTHING',
                [user.id],
              );
              await poolInstance.query(
                `UPDATE public."user" SET flags = '{"trustScore": 1, "vordr": false}' WHERE id = $1 AND flags = '{}'`,
                [user.id],
              );
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
      account: {
        create: {
          before: async (account) => {
            if (!poolInstance || !account.providerId || !account.accountId) {
              return;
            }
            try {
              const { rows } = await poolInstance.query(
                `SELECT "userId" FROM ba_account
                 WHERE "providerId" = $1 AND "accountId" = $2 AND "userId" != $3
                 LIMIT 1`,
                [account.providerId, account.accountId, account.userId],
              );
              if (rows.length > 0) {
                logger.warn(
                  {
                    providerId: account.providerId,
                    accountId: account.accountId,
                    existingUserId: rows[0].userId,
                    requestingUserId: account.userId,
                  },
                  'Blocked linking: social account already belongs to another user',
                );
                return false;
              }
            } catch (err) {
              logger.error(
                { err: err instanceof Error ? err.message : String(err) },
                'Failed to check existing account during link',
              );
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: (password: string) =>
          argon2.hash(password, { type: argon2.argon2id }),
        verify: ({ hash, password }: { hash: string; password: string }) =>
          argon2.verify(hash, password),
      },
    },
    socialProviders: {
      ...(process.env.GOOGLE_CLIENT_ID && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        },
      }),
      ...(process.env.GITHUB_CLIENT_ID && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
        },
      }),
      ...(process.env.APPLE_CLIENT_ID && {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
          appBundleIdentifier:
            process.env.APPLE_APP_BUNDLE_IDENTIFIER || undefined,
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

export const getBetterAuthPool = (): Pool => {
  if (!poolInstance) {
    throw new Error(
      'BetterAuth not initialized. Call initializeBetterAuth() first.',
    );
  }
  return poolInstance;
};
