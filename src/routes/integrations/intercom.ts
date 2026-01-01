import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import createOrGetConnection from '../../db';
import { User } from '../../entity';
import { getUnixTime } from 'date-fns';

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  fastify.get('/jwt', async (req, res) => {
    if (!req.userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const secret = process.env.INTERCOM_SECRET_KEY;
    if (!secret) {
      return res.status(503).send({ error: 'Intercom not configured' });
    }

    // Fetch user data for optional Intercom attributes
    const user = await con.getRepository(User).findOne({
      where: { id: req.userId },
      select: ['id', 'name', 'email', 'createdAt'],
    });

    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    // JWT payload with user_id (required) and optional attributes
    const payload: Record<string, string | number> = {
      user_id: user.id,
    };

    if (user.name) {
      payload.name = user.name;
    }

    if (user.email) {
      payload.email = user.email;
    }

    if (user.createdAt) {
      payload.created_at = getUnixTime(user.createdAt);
    }

    // Sign with HS256 and short expiry (10 minutes recommended minimum)
    const token = jwt.sign(payload, secret, {
      algorithm: 'HS256',
      expiresIn: '10m',
    });

    return res.send({ jwt: token });
  });
}
