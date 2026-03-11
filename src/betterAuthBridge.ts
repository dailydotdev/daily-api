import { createHmac } from 'crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { FastifyReply, FastifyRequest } from 'fastify';
import { getBetterAuth, getBetterAuthPool } from './betterAuth';
import type { WhoamiResponse } from './kratos';
import { addDays } from 'date-fns';
import { generateLongId, generateUUID } from './ids';
import { setCookie } from './cookies';

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

export const validateBetterAuthSession = async (
  req: FastifyRequest,
): Promise<WhoamiResponse> => {
  try {
    const auth = getBetterAuth();
    const session = (await auth.api.getSession({
      headers: fromNodeHeaders(
        req.headers as Record<string, string | string[] | undefined>,
      ),
    })) as BetterAuthSession | null;

    if (!session) {
      req.log.warn('BetterAuth getSession returned null');
      return { valid: false };
    }

    return {
      valid: true,
      userId: session.user.id,
      expires: addDays(new Date(), 30),
      verified: session.user.emailVerified,
      email: session.user.email,
    };
  } catch (error) {
    req.log.error(
      { err: error instanceof Error ? error.message : String(error) },
      'BetterAuth session validation failed',
    );
    return { valid: false };
  }
};

export const createBetterAuthSession = async ({
  req,
  res,
  userId,
}: {
  req: FastifyRequest;
  res: FastifyReply;
  userId: string;
}): Promise<boolean> => {
  try {
    const pool = getBetterAuthPool();

    const sessionId = generateUUID();
    const token = await generateLongId();
    const expiresAt = addDays(new Date(), 7);

    const { rows: dailyUser } = await pool.query(
      'SELECT id FROM public."user" WHERE id = $1 LIMIT 1',
      [userId],
    );
    if (dailyUser.length === 0) {
      req.log.warn('Cannot create BA session: user not found');
      return false;
    }

    await pool.query(
      `INSERT INTO ba_session (id, token, "userId", "expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent")
       VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6)`,
      [
        sessionId,
        token,
        userId,
        expiresAt,
        req.ip,
        req.headers['user-agent'] ?? null,
      ],
    );

    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      req.log.error('BETTER_AUTH_SECRET is not set, cannot sign session token');
      return false;
    }
    const signature = createHmac('sha256', secret)
      .update(token)
      .digest('base64');
    const signedToken = `${token}.${signature}`;
    setCookie(req, res, 'betterAuthSession', signedToken);

    return true;
  } catch (error) {
    req.log.error(
      { err: error instanceof Error ? error.message : String(error) },
      'Failed to create BetterAuth session from Kratos',
    );
    return false;
  }
};
