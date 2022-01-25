import { FastifyInstance } from 'fastify';
import { injectGraphql } from '../compatibility/utils';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
      userAlerts {
        filter
        rankLastSeen
        myFeed
      }
    }`;

    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['userAlerts'],
      req,
      res,
    );
  });
}
