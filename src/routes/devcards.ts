import { FastifyInstance, FastifyReply } from 'fastify';
import fetch from 'node-fetch';
import { getConnection } from 'typeorm';
import { DevCard } from '../entity';
import { generateDevCard } from '../templates/devcard';
import { getDevCardData } from '../common/devcard';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (req, res): Promise<FastifyReply> => {
      const [id, format] = req.params.id.split('.');
      if (['png', 'svg'].indexOf(format) < 0) {
        return res.status(404).send();
      }
      const con = getConnection();
      try {
        const devCard = await con.getRepository(DevCard).findOne(id);
        if (!devCard) {
          return res.status(404).send();
        }
        const { user, articlesRead, tags, sourcesLogos, rank } =
          await getDevCardData(devCard.userId, con);
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
          const response = await fetch(
            `${process.env.SCRAPER_URL}/screenshot`,
            {
              method: 'POST',
              body: JSON.stringify({ content: svgString, selector: 'svg' }),
              headers: { 'content-type': 'application/json' },
            },
          );
          return res
            .type(response.headers.get('content-type'))
            .header('cache-control', 'public, max-age=3600')
            .send(await response.buffer());
        }
        return res
          .type('image/svg+xml')
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
}
