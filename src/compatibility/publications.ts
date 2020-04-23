import { FastifyInstance } from 'fastify';
import { injectGraphqlQuery } from './utils';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
  sources(first: 500) {
    edges {
      node {
        id
        name
        image
      }
    }
  }
}`;
    return injectGraphqlQuery(
      fastify,
      query,
      (obj) => obj['data']['sources']['edges'].map((e) => e['node']),
      req,
      res,
    );
  });
}
