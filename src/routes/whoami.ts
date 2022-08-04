import { FastifyInstance } from 'fastify';
import { injectGraphql } from '../compatibility/utils';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
      whoami {
        id
        name
        image
        createdAt
        username
        bio
        twitter
        github
        hashnode
        infoConfirmed
      }
    }`;

    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['whoami'],
      req,
      res,
    );
  });
}
