import type { FastifyInstance } from 'fastify';
import createOrGetConnection from '../db';
import {
  UserIntegrationGif,
  UserIntegrationType,
  type Gif,
} from '../entity/UserIntegration';
import { tenorClient } from '../integrations/tenor';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    try {
      const query = req.query as { q?: string; limit?: string; pos?: string };
      const q = query.q ?? '';
      const limit = parseInt(query.limit ?? '10', 10);
      const pos = query.pos;

      const result = await tenorClient.search({ q, limit, pos });

      return res.send(result);
    } catch {
      return res.send({ gifs: [], next: undefined });
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
    } catch {
      return res.send({ gifs: [] });
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
    } catch {
      return res.send({ gifs: [] });
    }
  });
}
