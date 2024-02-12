import { FastifyInstance, FastifyReply } from 'fastify';
import { DevCard } from '../entity';
import createOrGetConnection from '../db';
import { retryFetch } from '../integrations/retry';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (req, res): Promise<FastifyReply> => {
      const [id] = req.params.id?.split('.') ?? [];
      const con = await createOrGetConnection();
      const devCard = await con.getRepository(DevCard).findOneBy({ id });

      if (!devCard) {
        return res.status(404).send();
      }
      return res.redirect(301, `/devcards/v2/${devCard.userId}.png`);
    },
  );

  fastify.get<{ Params: { name: string } }>(
    '/v2/:name',
    async (req, res): Promise<FastifyReply> => {
      const [userId, format] = req.params.name.split('.');
      if (format !== 'png') {
        return res.status(404).send();
      }
      const con = await createOrGetConnection();
      try {
        const devCard = await con.getRepository(DevCard).findOneBy({ userId });
        if (!devCard) {
          return res.status(404).send();
        }
        const url = `${process.env.COMMENTS_PREFIX}/devcards/${userId}`;
        const response = await retryFetch(
          `${process.env.SCRAPER_URL}/screenshot`,
          {
            method: 'POST',
            body: JSON.stringify({ url, selector: '#screenshot_wrapper' }),
            headers: { 'content-type': 'application/json' },
          },
        );
        return res
          .type(response.headers.get('content-type'))
          .header('cross-origin-opener-policy', 'cross-origin')
          .header('cross-origin-resource-policy', 'cross-origin')
          .header('cache-control', 'public, max-age=3600')
          .send(await response.buffer());
      } catch (err) {
        if (err.code === '22P02') {
          return res.status(404).send();
        }
        throw err;
      }
    },
  );
}
