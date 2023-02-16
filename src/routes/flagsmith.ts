import { FastifyInstance } from 'fastify';
import { notifyFeaturesReset } from '../common';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Querystring: { key?: string } }>(
    '/reset',
    async (req, res) => {
      const { key } = req.query;
      if (key === process.env.FLAGSMITH_WEBHOOK_SECRET) {
        req.log.info('sending features reset message');
        await notifyFeaturesReset(req.log);
      } else {
        req.log.info('wrong webhook key');
      }
      return res.status(204).send();
    },
  );
}
