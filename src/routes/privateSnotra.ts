import { FastifyInstance } from 'fastify';
import createOrGetConnection from '../db';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/all_tags', async (req, res) => {
    if (!req.service) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();
    const result = await con.query(`
       SELECT value AS name
       FROM keyword
       WHERE status = 'allow'
       ORDER BY name ASC
    `);

    return res.status(200).send(result);
  });

  fastify.get('/all_sources', async (req, res) => {
    if (!req.service) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();
    const result = await con.query(`
        SELECT id AS name
        FROM source
        WHERE type = 'machine' AND
              private = FALSE  AND
              active = TRUE
    `);

    return res.status(200).send(result);
  });

  fastify.get('/all_content_curations', async (req, res) => {
    if (!req.service) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();
    // this query might be hard on a database, we can consider extracting content curations
    // to a separate table
    const result = await con.query(`
        SELECT DISTINCT unnest("contentCuration") AS name
        FROM post
        ORDER BY name ASC;
    `);

    return res.status(200).send(result);
  });
}
