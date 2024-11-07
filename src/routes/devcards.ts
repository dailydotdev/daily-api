import { FastifyInstance, FastifyReply } from 'fastify';
import { encode } from 'he';
import { DevCard, User } from '../entity';
import createOrGetConnection from '../db';
import { retryFetch } from '../integrations/retry';
import { getDevCardDataV1 } from '../common/devcard';
import { generateDevCard } from '../templates/devcard';
import { TypeORMQueryFailedError } from '../errors';
import { WEBAPP_MAGIC_IMAGE_PREFIX } from '../config';

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
          username: user.username!,
          profileImage: user.image,
          articlesRead,
          tags,
          sourcesLogos,
          readingRank: rank.currentRank,
          backgroundImage: devCard.background!,
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
            .type(response.headers.get('content-type')!)
            .header('cross-origin-opener-policy', 'cross-origin')
            .header('cross-origin-resource-policy', 'cross-origin')
            .header('cache-control', 'public, max-age=3600, s-maxage=3600')
            .send(await response.buffer());
        }
        return res
          .type('image/svg+xml')
          .header('cross-origin-opener-policy', 'cross-origin')
          .header('cross-origin-resource-policy', 'cross-origin')
          .header('cache-control', 'public, max-age=3600, s-maxage=3600')
          .send(svgString);
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

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

  fastify.get<{ Params: { name: string }; Querystring: { type: string } }>(
    '/v2/:name',
    async (req, res): Promise<FastifyReply> => {
      const [userId, format] = req.params.name.split('.');
      if (!['png', 'svg'].includes(format)) {
        return res.status(404).send();
      }
      const con = await createOrGetConnection();
      try {
        const user = await con.getRepository(User).findOneBy({ id: userId });
        if (!user) {
          return res.status(404).send();
        }
        const type = req.query?.type?.toLowerCase() ?? 'default';

        // for svg, return the same image as png, wrapped in svg tag
        if (format === 'svg') {
          const pngUrl = `${process.env.URL_PREFIX}${req.originalUrl.replace('.svg', '.png')}`;
          const encodedUrl = encode(pngUrl, { useNamedReferences: true });
          const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><image href="${encodedUrl}" /></svg>`;

          return res
            .type('image/svg+xml')
            .header('cross-origin-opener-policy', 'cross-origin')
            .header('cross-origin-resource-policy', 'cross-origin')
            .header('cache-control', 'public, max-age=3600')
            .send(svgString);
        }

        const url = new URL(
          `${WEBAPP_MAGIC_IMAGE_PREFIX}/devcards/${userId}`,
          process.env.COMMENTS_PREFIX,
        );
        url.searchParams.set('type', type);
        const response = await retryFetch(
          `${process.env.SCRAPER_URL}/screenshot`,
          {
            method: 'POST',
            body: JSON.stringify({ url, selector: '#screenshot_wrapper' }),
            headers: { 'content-type': 'application/json' },
          },
        );
        return res
          .type(response.headers.get('content-type')!)
          .header('cross-origin-opener-policy', 'cross-origin')
          .header('cross-origin-resource-policy', 'cross-origin')
          .header('cache-control', 'public, max-age=3600, s-maxage=3600')
          .send(await response.buffer());
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

        if (err.code === '22P02') {
          return res.status(404).send();
        }
        throw err;
      }
    },
  );
}
