import { FastifyInstance } from 'fastify';
import { Automation, automations } from '../integrations/automation';
import { HttpError } from '../integrations/retry';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: Record<string, unknown>; Params: { name: Automation } }>(
    '/:name',
    async (req, res) => {
      const { body, userId } = req;
      const auto = automations[req.params.name];
      if (!auto) {
        return res.status(404).send();
      }
      if (!userId) {
        return res.status(401).send();
      }
      try {
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
