import { createHmac } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { addDays } from 'date-fns';
import createOrGetConnection from './db';
import { generateLongId, generateUUID } from './ids';
import { setCookie } from './cookies';

export const createBetterAuthSessionFromKratos = async ({
  req,
  res,
  userId,
}: {
  req: FastifyRequest;
  res: FastifyReply;
  userId: string;
}): Promise<boolean> => {
  try {
    const con = await createOrGetConnection();

    const sessionId = generateUUID();
    const token = await generateLongId();
    const expiresAt = addDays(new Date(), 7);

    const dailyUser = await con.query(
      'SELECT id FROM public."user" WHERE id = $1 LIMIT 1',
      [userId],
    );
    if (dailyUser.length === 0) {
      req.log.warn('Cannot create BA session: user not found');
      return false;
    }

    await con.query(
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
