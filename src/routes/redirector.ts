import { FastifyInstance } from 'fastify';
import isbot from 'isbot';
import { getConnection } from 'typeorm';
import { Post } from '../entity';
import { notifyView } from '../common';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/:postId', async (req, res) => {
    const con = getConnection();
    const post = await con.getRepository(Post).findOne({
      select: ['id', 'url'],
      where: [{ id: req.params.postId }, { shortId: req.params.postId }],
    });
    if (!post) {
      return res.status(404).send();
    }
    if (!req.headers['user-agent'] || isbot(req.headers['user-agent'])) {
      return res.status(302).redirect(post.url);
    }
    const userId = req.userId || req.cookies.da2;
    if (userId) {
      notifyView(req.log, post.id, userId, req.headers['referer'], new Date());
    }
    return res
      .type('text/html')
      .send(
        `<html><head><meta http-equiv="refresh" content="0;URL=${post.url}${
          req.query.a ? `#${req.query.a}` : ''
        }"></head></html>`,
      );
  });
}
