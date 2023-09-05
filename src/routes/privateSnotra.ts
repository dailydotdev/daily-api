import { FastifyInstance } from 'fastify';
import createOrGetConnection from '../db';
import { Keyword, Source, Post } from '../entity';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/all_tags', async (req, res) => {
    if (!req.service) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();
    const result = await con
      .createQueryBuilder()
      .select('value', 'name')
      .from(Keyword, 'keyword')
      .where('status = :status', { status: 'allow' })
      .orderBy('name', 'ASC')
      .getRawMany<{ name: string }>();

    return res.status(200).send(result);
  });

  fastify.get('/all_sources', async (req, res) => {
    if (!req.service) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();
    const result = await con
      .createQueryBuilder()
      .select('id', 'name')
      .from(Source, 'source')
      .where('type = :type', { type: 'machine' })
      .andWhere('private = :private', { private: false })
      .andWhere('active = :active', { active: true })
      .orderBy('name', 'ASC')
      .getRawMany<{ name: string }>();

    return res.status(200).send(result);
  });

  fastify.get('/all_content_curations', async (req, res) => {
    if (!req.service) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();
    // this query might be hard on a database, we can consider extracting content curations
    // to a separate table
    const result = await con
      .createQueryBuilder()
      .select('unnest("contentCuration")', 'name')
      .from(Post, 'post')
      .distinct(true)
      .orderBy('name', 'ASC')
      .getRawMany<{ name: string }>();

    return res.status(200).send(result);
  });
}
