import { LogoutReason } from '../common';
import { getShortGenericInviteLink } from '../common';
import { deleteUser } from '../common/user';
import { clearAuthentication } from '../cookies';
import createOrGetConnection from '../db';
import type { FastifyInstance } from 'fastify';
import type { FastifyReply } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { getBootData } from './boot';
import { logoutBetterAuth } from './betterAuth';

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
    const referralLink = req.userId
      ? await getShortGenericInviteLink(req.log, req.userId)
      : undefined;

    return res.send({
      ...boot.user,
      ...boot.visit,
      referralLink,
      accessToken: 'accessToken' in boot ? boot.accessToken : undefined,
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
