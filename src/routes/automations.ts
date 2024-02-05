import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Automation, automations } from '../integrations/automation';
import { HttpError } from '../integrations/retry';
import { singleRedisClient } from '../redis';

export default async function (fastify: FastifyInstance): Promise<void> {
  const counter = fastify.meter?.createCounter('automations', {
    description: 'How many automations were triggered',
  });

  fastify.register(rateLimit, {
    max: 2,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.userId,
    redis: singleRedisClient,
    nameSpace: 'auto-rl:',
  });

  fastify.post<{ Body: Record<string, unknown>; Params: { name: Automation } }>(
    '/:name',
    async (req, res) => {
      const { body, userId } = req;
      const name = req.params.name;
      const auto = automations[name];
      if (!auto) {
        return res.status(404).send();
      }
      if (!userId) {
        return res.status(401).send();
      }
      try {
        counter?.add(1, { name });
        const autoRes = await auto.run({ ...body, userId });
        return res.status(200).send(autoRes);
      } catch (err) {
        if (err instanceof HttpError && err.statusCode < 500) {
          return res.status(err.statusCode).send(err.response);
        }
        throw err;
      }
    },
  );
}
