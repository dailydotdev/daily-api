import { FastifyInstance } from 'fastify';
import { injectGraphql } from './utils';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
  latestNotifications {
    timestamp
    html
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['latestNotifications'],
      req,
      res,
    );
  });
}
