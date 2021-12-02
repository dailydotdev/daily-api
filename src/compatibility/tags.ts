import { FastifyInstance } from 'fastify';
import { injectGraphql } from './utils';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/popular', async (req, res) => {
    const query = `{
  popularTags {
    name
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['popularTags'],
      req,
      res,
    );
  });

  fastify.get<{ Querystring: { query: string } }>(
    '/search',
    async (req, res) => {
      const query = `{
  searchTags(query: "${req.query.query}") {
    query
    hits {
      name
    }
  }
}`;
      return injectGraphql(
        fastify,
        { query },
        (obj) => obj['data']['searchTags'],
        req,
        res,
      );
    },
  );
}
