import { FastifyInstance, FastifyReply } from 'fastify';
import qs from 'qs';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (req, res): Promise<FastifyReply> => {
      const [id] = req.params.id?.split('.') ?? [];
      const query = qs.stringify(req.query);
      return res.redirect(
        301,
        `${process.env.OG_URL}/devcards/${id}.png${query && '?'}${query}`,
      );
    },
  );
}
