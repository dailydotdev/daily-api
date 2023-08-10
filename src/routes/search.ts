import { FastifyInstance } from 'fastify';
import { postFeedback } from '../integrations';
import { isNullOrUndefined } from '../common/object';

export interface FeedbackArgs {
  value: number;
  chunkId: string;
}

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: FeedbackArgs }>('/feedback', async (req, res) => {
    const { userId, body } = req;

    if (!userId) {
      return res.status(401).send();
    }

    if (!body.chunkId) {
      return res.status(400).send('Missing chunk id');
    }

    if (isNullOrUndefined(body.value) || body.value > 1 || body.value < -1) {
      return res.status(400).send('Invalid value');
    }

    return postFeedback(req);
  });
}
