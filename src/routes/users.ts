import { FastifyInstance } from 'fastify';
import { logout } from '../kratos';
import { deleteUser } from '../directive/user';
import createOrGetConnection from '../db';
import { getBootData, LoggedInBoot } from './boot';

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  // Support legacy moderation platform
  fastify.get('/me', async (req, res) => {
    const boot = await getBootData(con, req, res);
    return res.send({
      ...boot.user,
      ...boot.visit,
      accessToken: (boot as LoggedInBoot).accessToken,
    });
  });

  fastify.post('/logout', logout);

  fastify.delete('/me', async (req, res) => {
    const { userId } = req;
    if (!userId) {
      return res.status(401).send();
    }

    await deleteUser(con, req.log, userId);
    return logout(req, res, true);
  });
}
