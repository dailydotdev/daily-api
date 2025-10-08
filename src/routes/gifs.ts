import type { FastifyInstance } from 'fastify';
import createOrGetConnection from '../db';
import {
  UserIntegrationGif,
  UserIntegrationType,
  type Gif,
} from '../entity/UserIntegration';

type TenorGif = {
  id: string;
  media: Array<{ gif?: { url: string }; mediumgif?: { url: string } }>;
  content_description?: string;
};
export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    try {
      const query = req.query as { q?: string; limit?: string; pos?: string };
      const q = query.q ?? '';
      const limit = parseInt(query.limit ?? '10', 10);
      const pos = query.pos; // Pagination token from Tenor

      if (!q) {
        return res.send({ gifs: [], next: undefined });
      }

      const params = new URLSearchParams({
        q: encodeURIComponent(q),
        key: process.env.TENOR_API_KEY!,
        limit: limit.toString(),
      });

      // Add pos parameter if it exists (for pagination)
      if (pos) {
        params.append('pos', pos);
      }

      const tenorRes = await fetch(
        `https://g.tenor.com/v1/search?${params.toString()}`,
      );

      const tenorJson = await tenorRes.json();

      const gifs: Gif[] = (tenorJson.results ?? []).map((item: TenorGif) => ({
        id: item.id,
        url: item.media[0]?.gif?.url || '',
        preview: item.media[0]?.mediumgif?.url || '',
        title: item.content_description || '',
      }));

      return res.send({
        gifs,
        next: tenorJson.next, // Pass through Tenor's pagination token
      });
    } catch (error) {
      console.error('Error fetching gifs:', error);
      return res.status(500).send({ error: 'Failed to fetch gifs' });
    }
  });
  fastify.post('/favorite', async (req, res) => {
    try {
      const con = await createOrGetConnection();
      console.log('--- req user id', req.userId);
      const existingFavorites = await con
        .getRepository(UserIntegrationGif)
        .findOne({
          where: {
            userId: req.userId,
            type: UserIntegrationType.Gif,
          },
        });

      const newFavorite = req.body as Gif;
      const gifs: Gif[] = [];
      if (existingFavorites?.meta) {
        gifs.push(...existingFavorites.meta.favorites);
      }

      if (gifs.find((g) => g.id === newFavorite.id))
        return res.status(403).send({ error: 'Gif already favorited' });

      gifs.push(newFavorite);

      if (existingFavorites) {
        await con.getRepository(UserIntegrationGif).update(
          {
            userId: req.userId,
            type: UserIntegrationType.Gif,
          },
          {
            meta: {
              favorites: gifs,
            },
          },
        );
      } else {
        await con.getRepository(UserIntegrationGif).insert({
          userId: req.userId,
          type: UserIntegrationType.Gif,
          meta: {
            favorites: gifs,
          },
        });
      }

      return res.send({ favorites: gifs });
    } catch (e) {
      console.error('*** favorite err', e);
      return res.status(500).send({ error: 'Failed to favorite gif' });
    }
  });
  fastify.get('/favorites', async (req, res) => {
    try {
      const con = await createOrGetConnection();
      const existingFavorites = await con
        .getRepository(UserIntegrationGif)
        .find({
          where: {
            userId: req.userId,
            type: UserIntegrationType.Gif,
          },
        });

      const favorites: Gif[] = [];
      existingFavorites.forEach((fav) => {
        if (fav.meta) {
          favorites.push(...(fav.meta.favorites as Gif[]));
        }
      });

      return res.send({ favorites });
    } catch (e) {
      return res.status(500).send({ error: 'Failed to fetch favorite gifs' });
    }
  });
}
