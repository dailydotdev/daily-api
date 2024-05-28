import { FastifyInstance } from 'fastify';
import { injectGraphql } from '../compatibility/utils';
import { verifyJwt } from '../auth';
import { UnsubscribeGroup } from '../common';
import createOrGetConnection from '../db';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestType,
} from '../entity';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
      unreadNotificationsCount
    }`;

    return injectGraphql(fastify, { query }, (obj) => obj['data'], req, res);
  });

  // https://customer.io/docs/journeys/custom-unsubscribe-links/#step-1-configure-your-system-to-receive-the-post-when-recipients-click-unsubscribe
  fastify.post<{ Querystring: { token: string } }>(
    '/unsubscribe',
    async (req, res) => {
      const payload = await verifyJwt<{
        userId: string;
        group: UnsubscribeGroup;
      }>(req.query.token);
      if (payload) {
        const con = await createOrGetConnection();
        switch (payload.group) {
          case UnsubscribeGroup.Notifications:
            await con
              .getRepository(User)
              .update({ id: payload.userId }, { notificationEmail: false });
            break;
          case UnsubscribeGroup.Digest:
            await con.getRepository(UserPersonalizedDigest).delete({
              userId: payload.userId,
              type: UserPersonalizedDigestType.Digest,
            });
            break;
        }
      }
      return res.status(204).send();
    },
  );
}
