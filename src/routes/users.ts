import { FastifyInstance } from 'fastify';
import { logout } from '../kratos';
import { deleteUser } from '../directive/user';
import createOrGetConnection from '../db';

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  fastify.post('/logout', logout);

  fastify.delete('/me', async (req, res) => {
    const { userId } = req;
    if (!userId) {
      return res.status(401).send();
    }

    await deleteUser(con, req.log, userId);
    return logout(req, res);
  });
}
