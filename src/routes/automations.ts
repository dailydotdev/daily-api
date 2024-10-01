import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Automation, automations } from '../integrations/automation';
import { HttpError } from '../integrations/retry';
import { singleRedisClient } from '../redis';
import { counters } from '../telemetry';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rateLimit, {
    max: 2,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.userId as string,
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
        counters?.api?.automations?.add(1, { name });
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
