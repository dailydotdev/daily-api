import { FastifyInstance, FastifyReply } from 'fastify';
import { ServerResponse } from 'http';
import fetch from 'node-fetch';
import { Connection, getConnection } from 'typeorm';
import { DevCard } from '../entity/DevCard';
import { generateDevCard } from '../templates/devcard';
import { fetchUser, getUserReadingRank } from '../common';
import { Post, PostKeyword, Source, View } from '../entity';

const getMostReadTags = (
  con: Connection,
  userId: string,
): Promise<{ value: string; count: number }[]> =>
  con
    .createQueryBuilder()
    .select('pk.keyword', 'value')
    .addSelect('count(*)', 'count')
    .from(View, 'v')
    .innerJoin(PostKeyword, 'pk', 'v."postId" = pk."postId"')
    .where('v."userId" = :id', { id: userId })
    .andWhere(`pk.status = 'allow'`)
    .andWhere(`pk.keyword != 'general-programming'`)
    .groupBy('pk.keyword')
    .orderBy('2', 'DESC')
    .limit(4)
    .getRawMany();

const getFavoriteSourcesLogos = async (
  con: Connection,
  userId: string,
): Promise<string[]> => {
  const sources = await con
    .createQueryBuilder()
    .select('min(source.image)', 'image')
    .from(View, 'v')
    .innerJoin(Post, 'p', 'v."postId" = p.id')
    .innerJoin(
      (qb) =>
        qb
          .select('"sourceId"')
          .addSelect('count(*)', 'count')
          .from(Post, 'post')
          .groupBy('"sourceId"'),
      's',
      's."sourceId" = p."sourceId"',
    )
    .innerJoin(
      Source,
      'source',
      'source.id = p."sourceId" and source.active = true and source.private = false',
    )
    .where('v."userId" = :id', { id: userId })
    .andWhere(`s.count > 10`)
    .groupBy('p."sourceId"')
    .orderBy('count(*) * 1.0 / min(s.count)', 'DESC')
    .limit(5)
    .getRawMany();
  return sources.map((source) => source.image);
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/:id',
    async (req, res): Promise<FastifyReply<ServerResponse>> => {
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
        const [user, articlesRead, tags, sourcesLogos, rank] =
          await Promise.all([
            fetchUser(devCard.userId),
            con.getRepository(View).count({ userId: devCard.userId }),
            getMostReadTags(con, devCard.userId),
            getFavoriteSourcesLogos(con, devCard.userId),
            getUserReadingRank(con, devCard.userId),
          ]);
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
