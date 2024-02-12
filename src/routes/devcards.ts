import { FastifyInstance, FastifyReply } from 'fastify';
import { DevCard } from '../entity';
import createOrGetConnection from '../db';
import { retryFetch } from '../integrations/retry';
import { getDevCardDataV1 } from '../common/devcard';
import { generateDevCard } from '../templates/devcard';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (req, res): Promise<FastifyReply> => {
      const [id, format] = req.params.id.split('.');
      if (['png', 'svg'].indexOf(format) < 0) {
        return res.status(404).send();
      }
      const con = await createOrGetConnection();
      try {
        const devCard = await con.getRepository(DevCard).findOneBy({ id });
        if (!devCard) {
          return res.status(404).send();
        }
        const { user, articlesRead, tags, sourcesLogos, rank } =
          await getDevCardDataV1(devCard.userId, con);
        const svgString = generateDevCard({
          username: user.username,
          profileImage: user.image,
          articlesRead,
          tags,
          sourcesLogos,
          readingRank: rank.currentRank,
          backgroundImage: devCard.background,
        });
        if (format === 'png') {
          const response = await retryFetch(
            `${process.env.SCRAPER_URL}/screenshot`,
            {
              method: 'POST',
              body: JSON.stringify({ content: svgString, selector: 'svg' }),
              headers: { 'content-type': 'application/json' },
            },
          );
          return res
            .type(response.headers.get('content-type'))
            .header('cross-origin-opener-policy', 'cross-origin')
            .header('cross-origin-resource-policy', 'cross-origin')
            .header('cache-control', 'public, max-age=3600')
            .send(await response.buffer());
        }
        return res
          .type('image/svg+xml')
          .header('cross-origin-opener-policy', 'cross-origin')
          .header('cross-origin-resource-policy', 'cross-origin')
          .header('cache-control', 'public, max-age=3600')
          .send(svgString);
      } catch (err) {
        if (err.code === '22P02') {
          return res.status(404).send();
        }
        throw err;
      }
    },
  );

  // Intentionally commenting this out. For now we'll use the existing endpoint as
  // is until we verify that the new one works as expected. We can then turn on this
  // redirect...
  //
  // fastify.get<{ Params: { id: string } }>(
  //   '/:id',
  //   async (req, res): Promise<FastifyReply> => {
  //     const [id] = req.params.id?.split('.') ?? [];
  //     const con = await createOrGetConnection();
  //     const devCard = await con.getRepository(DevCard).findOneBy({ id });

  //     if (!devCard) {
  //       return res.status(404).send();
  //     }
  //     return res.redirect(301, `/devcards/v2/${devCard.userId}.png`);
  //   },
  // );

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
