import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { deleteUser } from '../common/user';
import { LogoutReason } from '../common';
import createOrGetConnection from '../db';
import { getBootData, LoggedInBoot } from './boot';
import { getShortGenericInviteLink } from '../common';
import { clearAuthentication } from '../cookies';
import { callBetterAuth } from './betterAuth';

const logoutBetterAuth = async (
  req: FastifyRequest,
  res: FastifyReply,
): Promise<void> => {
  try {
    await callBetterAuth({
      req,
      reply: res,
      path: '/auth/sign-out',
      method: 'POST',
    });
  } catch (err) {
    req.log.warn({ err }, 'error during BetterAuth sign-out');
  }
};

const logout = async (
  req: FastifyRequest,
  res: FastifyReply,
  isDeletion = false,
): Promise<FastifyReply> => {
  const query = req.query as { reason?: LogoutReason };
  const queryReason = query?.reason as LogoutReason;
  const reason = Object.values(LogoutReason).includes(queryReason)
    ? queryReason
    : LogoutReason.ManualLogout;

  await logoutBetterAuth(req, res);

  await clearAuthentication(
    req,
    res,
    isDeletion ? LogoutReason.UserDeleted : reason,
  );
  return res.status(204).send();
};

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  // Support legacy moderation platform
  fastify.get('/me', async (req, res) => {
    const boot = await getBootData(con, req, res);
    return res.send({
      ...boot.user,
      ...boot.visit,
      referralLink: await getShortGenericInviteLink(req.log, req.userId!),
      accessToken: (boot as LoggedInBoot).accessToken,
    });
  });

  fastify.post('/logout', logout);

  fastify.delete('/me', async (req, res) => {
    const { userId } = req;
    if (!userId) {
      return res.status(401).send();
    }

    await deleteUser(con, userId);
    return logout(req, res, true);
  });
}
