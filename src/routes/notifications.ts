import { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { executeGraphql } from './public/graphqlExecutor';

interface UnreadNotificationsResponse {
  unreadNotificationsCount: number;
}

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
      unreadNotificationsCount
    }`;

    return executeGraphql<UnreadNotificationsResponse>(
      con,
      { query },
      (obj) => obj as unknown as UnreadNotificationsResponse,
      req,
      res,
    );
  });
}
