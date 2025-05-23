import { FastifyInstance } from 'fastify';
import { isProd } from '../../../common';
import { SubscriptionProvider } from '../../../entity';
import { logger } from '../../../logger';

import { isCoreTransaction, paddleInstance } from '../../../common/paddle';

import { remoteConfig } from '../../../remoteConfig';
import { processCorePaddleEvent } from '../../../common/paddle/cores/eventHandler';
import { processPlusPaddleEvent } from '../../../common/paddle/plus/eventHandler';

export const paddle = async (fastify: FastifyInstance): Promise<void> => {
  fastify.register(async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook('onRequest', async (request, res) => {
      if (
        isProd &&
        remoteConfig.vars.paddleIps &&
        !remoteConfig.vars.paddleIps.includes(request.ip)
      ) {
        return res.status(403).send({ error: 'Forbidden' });
      }
    });

    fastify.post('/', {
      config: {
        rawBody: true,
      },
      handler: async (req, res) => {
        const signature = (req.headers['paddle-signature'] as string) || '';
        const rawRequestBody = req.rawBody?.toString();
        const secretKey = process.env.PADDLE_WEBHOOK_SECRET || '';

        try {
          if (signature && rawRequestBody) {
            const eventData = await paddleInstance.webhooks.unmarshal(
              rawRequestBody,
              secretKey,
              signature,
            );

            switch (true) {
              case isCoreTransaction({ event: eventData }): {
                await processCorePaddleEvent(eventData);
                break;
              }
              default: {
                await processPlusPaddleEvent(eventData);
                break;
              }
            }
          } else {
            logger.error(
              { provider: SubscriptionProvider.Paddle },
              'Signature missing in header',
            );
          }
        } catch (originalError) {
          const err = originalError as Error;

          logger.error(
            {
              err,
              provider: SubscriptionProvider.Paddle,
              payload: rawRequestBody,
            },
            'Paddle generic error',
          );
        }
        res.send('Processed webhook event');
      },
    });
  });
};
