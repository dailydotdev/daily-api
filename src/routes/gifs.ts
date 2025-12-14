import type { FastifyInstance } from 'fastify';
import createOrGetConnection from '../db';
import {
  UserIntegrationGif,
  UserIntegrationType,
  type Gif,
} from '../entity/UserIntegration';

type TenorGif = {
  id: string;
  title: string;
  media_formats: Record<string, unknown>;
  content_description: string;
  url: string;
};

type TenorResponse = {
  results: TenorGif[];
  next?: string;
};
export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    try {
      const query = req.query as { q?: string; limit?: string; pos?: string };
      const q = query.q ?? '';
      const limit = parseInt(query.limit ?? '10', 10);
      const pos = query.pos;

      if (!q) {
        return res.send({ gifs: [], next: undefined });
      }

      const params = new URLSearchParams({
        q: q,
        key: process.env.TENOR_API_KEY!,
        limit: limit.toString(),
      });

      if (pos) {
        params.append('pos', pos);
      }

      const tenorRes = await fetch(
        `https://tenor.googleapis.com/v2/search?${params.toString()}`,
      );

      const tenorJson = (await tenorRes.json()) as TenorResponse;

      const gifs: Gif[] = tenorJson.results.map((item: TenorGif) => {
        const mediaFormats = item.media_formats as Record<
          string,
          { url?: string }
        >;
        return {
          id: item.id,
          url: mediaFormats.gif?.url || '',
          preview: mediaFormats.mediumgif?.url || mediaFormats.gif?.url || '',
          title: item.content_description || item.title || '',
        };
      });

      return res.send({
        gifs,
        next: tenorJson.next,
      });
    } catch (error) {
      return res.status(500).send({ error: 'Failed to fetch gifs' });
    }
  });
  fastify.post('/favorite', async (req, res) => {
    try {
      const con = await createOrGetConnection();

      const existingFavorites = await con
        .getRepository(UserIntegrationGif)
        .findOne({
          where: {
            userId: req.userId,
            type: UserIntegrationType.Gif,
          },
        });

      const gifToToggle = req.body as Gif;
      const gifs: Gif[] = [];
      if (existingFavorites?.meta) {
        gifs.push(...existingFavorites.meta.favorites);
      }

      const existingIndex = gifs.findIndex((g) => g.id === gifToToggle.id);

      if (existingIndex !== -1) {
        gifs.splice(existingIndex, 1);
      } else {
        gifs.push(gifToToggle);
      }

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

      return res.send({ gifs });
    } catch (e) {
      return res.status(500).send({ error: 'Failed to toggle favorite gif' });
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

      return res.send({ gifs: favorites });
    } catch (e) {
      return res.status(500).send({ error: 'Failed to fetch favorite gifs' });
    }
  });
}
