import { URL } from 'url';
import { FastifyInstance } from 'fastify';
import { ArticlePost, Post } from '../entity';
import { notifyView } from '../common';
import createOrGetConnection from '../db';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { postId: string }; Querystring: { a?: string } }>(
    '/:postId',
    async (req, res) => {
      const con = await createOrGetConnection();
      const q = con
        .createQueryBuilder()
        .select([
          'post.id AS id',
          'post.url AS url',
          'post.tagsStr AS "tagsStr"',
        ])
        .from(Post, 'post')
        .where('post.id = :id OR post.shortId = :id', {
          id: req.params.postId,
        });

      const post =
        await q.getRawOne<Pick<ArticlePost, 'id' | 'url' | 'tagsStr'>>();

      if (!post) {
        return res.status(404).send();
      }
      const url = new URL(post.url);
      url.searchParams.append('ref', 'dailydev');
      const encodedUri = encodeURI(url.href);
      if (req.isBot) {
        return res.status(302).redirect(encodedUri);
      }
      const userId = req.userId || req.trackingId;
      if (userId) {
        notifyView(
          req.log,
          post.id,
          userId,
          req.headers['referer'],
          new Date(),
          post.tagsStr?.split?.(',') ?? [],
        );
      }
      return res
        .headers({
          'Referrer-Policy': 'origin, origin-when-cross-origin',
          Link: `<${encodedUri}>; rel="preconnect"`,
        })
        .type('text/html')
        .send(
          `<html><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;URL=${encodedUri}${
            req.query.a ? `#${req.query.a}` : ''
          }"></head></html>`,
        );
    },
  );
}
