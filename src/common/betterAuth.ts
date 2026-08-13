import type { FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { getBetterAuth } from '../betterAuth';
import { asyncRetry } from '../integrations/retry';

type BetterAuthSession = {
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
};

export const getBetterAuthSessionForRequest = async (
  req: FastifyRequest,
): Promise<BetterAuthSession | null> =>
  asyncRetry(
    () =>
      getBetterAuth().api.getSession({
        headers: fromNodeHeaders(
          req.headers as Record<string, string | string[] | undefined>,
        ),
      }),
    { retries: 3 },
  );
