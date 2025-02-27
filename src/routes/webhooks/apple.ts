import type { FastifyInstance, FastifyRequest } from 'fastify';
import { logger } from '../../logger';

export const apple = async (fastify: FastifyInstance): Promise<void> => {
  // Endpoint for receiving App Store Server Notifications V2
  fastify.post('/notifications', async (req: FastifyRequest) => {
    logger.info(
      {
        payload: req.body,
        headers: req.headers,
      },
      'Received Apple App Store Server Notification',
    );
    return {
      received: true,
    };
  });
};
