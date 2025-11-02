import { FastifyInstance } from 'fastify';
import { isProd } from '../../../common';
import { PurchaseType, SubscriptionProvider } from '../../../common/plus';
import { logger } from '../../../logger';

import { isPurchaseType, paddleInstance } from '../../../common/paddle';

import { remoteConfig } from '../../../remoteConfig';
import { processCorePaddleEvent } from '../../../common/paddle/cores/eventHandler';
import { processPlusPaddleEvent } from '../../../common/paddle/plus/eventHandler';
import { processOrganizationPaddleEvent } from '../../../common/paddle/organization/eventHandler';

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
            const event = await paddleInstance.webhooks.unmarshal(
              rawRequestBody,
              secretKey,
              signature,
            );

            switch (true) {
              case isPurchaseType(PurchaseType.Cores, event):
                await processCorePaddleEvent(event);
                break;
              case isPurchaseType(PurchaseType.Organization, event):
                await processOrganizationPaddleEvent(event);
                break;
              case isPurchaseType(PurchaseType.Plus, event):
                await processPlusPaddleEvent(event);
                break;
              case isPurchaseType(PurchaseType.Recruiter, event):
                break;
              default:
                logger.info(
                  { eventType: event.eventType },
                  'Unhandled Paddle event type',
                );
                break;
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
