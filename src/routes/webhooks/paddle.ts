import { FastifyInstance } from 'fastify';
import {
  Environment,
  EventName,
  Paddle,
  SubscriptionCanceledEvent,
  SubscriptionCreatedEvent,
} from '@paddle/paddle-node-sdk';
import createOrGetConnection from '../../db';
import { updateSubscriptionFlags } from '../../common';
import { User } from '../../entity';
import { logger } from '../../logger';
import { planTypes } from '../../paddle';

const paddleInstance = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENVIRONMENT as Environment,
});

const updateUserSubscription = async ({
  data,
  state,
}: {
  data: SubscriptionCreatedEvent | SubscriptionCanceledEvent | undefined;
  state: boolean;
}) => {
  if (!data) {
    return;
  }
  const con = await createOrGetConnection();
  const userId = data.data?.customData?.user_id;
  if (!userId) {
    logger.error({ type: 'paddle' }, 'User ID missing in payload');
    return false;
  }
  const subscriptionType = data.data?.items.reduce((acc, item) => {
    if (planTypes[item.price?.id]) {
      acc = planTypes[item.price?.id];
    }
    return acc;
  }, null);
  if (!subscriptionType) {
    logger.error(
      {
        type: 'paddle',
        data,
      },
      'Subscription type missing in payload',
    );
    return false;
  }
  await con.getRepository(User).update(
    {
      id: data.data?.customData?.user_id,
    },
    {
      subscriptionFlags: updateSubscriptionFlags({
        cycle: state ? subscriptionType : null,
        createdAt: state ? data.data?.startedAt : null,
        subscriptionId: state ? data.data?.id : null,
      }),
    },
  );
};

export const paddle = async (fastify: FastifyInstance): Promise<void> => {
  fastify.register(async (fastify: FastifyInstance): Promise<void> => {
    fastify.post('/', {
      config: {
        rawBody: true,
      },
      handler: async (req, res) => {
        const signature = (req.headers['paddle-signature'] as string) || '';
        const rawRequestBody = req.rawBody;
        const secretKey = process.env.PADDLE_WEBHOOK_SECRET || '';

        try {
          if (signature && rawRequestBody) {
            const eventData = paddleInstance.webhooks.unmarshal(
              rawRequestBody,
              secretKey,
              signature,
            );

            switch (eventData?.eventType) {
              case EventName.SubscriptionCreated:
                await updateUserSubscription({
                  data: eventData,
                  state: true,
                });
                break;
              case EventName.SubscriptionCanceled:
                await updateUserSubscription({
                  data: eventData,
                  state: false,
                });
              default:
                logger.info({ type: 'paddle' }, eventData.eventType);
            }
          } else {
            logger.error({ type: 'paddle' }, 'Signature missing in header');
          }
        } catch (e) {
          logger.error({ type: 'paddle', e }, 'Paddle generic error');
        }
        res.send('Processed webhook event');
      },
    });
  });
};
