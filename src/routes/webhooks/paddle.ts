import { FastifyInstance } from 'fastify';
import {
  Environment,
  EventName,
  Paddle,
  SubscriptionCanceledEvent,
  SubscriptionCreatedEvent,
  SubscriptionItemNotification,
  SubscriptionUpdatedEvent,
  TransactionCompletedEvent,
  TransactionItemNotification,
} from '@paddle/paddle-node-sdk';
import createOrGetConnection from '../../db';
import { updateSubscriptionFlags } from '../../common';
import { User } from '../../entity';
import { logger } from '../../logger';
import { remoteConfig } from '../../remoteConfig';
import {
  AnalyticsEventName,
  sendAnalyticsEvent,
} from '../../integrations/analytics';
import { JsonContains } from 'typeorm';

const paddleInstance = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENVIRONMENT as Environment,
});

const extractSubscriptionType = (
  items:
    | SubscriptionItemNotification[]
    | TransactionItemNotification[]
    | undefined,
): string => {
  if (!items) {
    return '';
  }
  return items.reduce((acc, item) => {
    const pricingIds = remoteConfig.vars?.pricingIds;
    if (item.price?.id && pricingIds?.[item.price.id]) {
      acc = pricingIds?.[item.price.id] || '';
    }
    return acc;
  }, '');
};

const updateUserSubscription = async ({
  data,
  state,
}: {
  data:
    | SubscriptionCreatedEvent
    | SubscriptionCanceledEvent
    | SubscriptionUpdatedEvent
    | undefined;
  state: boolean;
}) => {
  if (!data) {
    return;
  }

  const customData = data.data?.customData as { user_id: string };

  const con = await createOrGetConnection();
  const userId = customData?.user_id;
  if (!userId) {
    logger.error({ type: 'paddle' }, 'User ID missing in payload');
    return false;
  }

  const subscriptionType = extractSubscriptionType(data.data?.items);

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
      id: userId,
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

const getUserId = async ({
  subscriptionId,
  userId,
}: {
  subscriptionId?: false | string | null;
  userId?: string | undefined;
}): Promise<string> => {
  if (userId) {
    return userId;
  }

  const con = await createOrGetConnection();
  const user = await con.getRepository(User).findOne({
    where: { subscriptionFlags: JsonContains({ subscriptionId }) },
    select: ['id'],
  });

  if (!user) {
    logger.error({ type: 'paddle', subscriptionId, userId }, 'User not found');
    return '';
  }

  return user.id;
};

const planChanged = async (data: SubscriptionUpdatedEvent) => {
  const customData = data.data?.customData as { user_id: string };
  const userId = await getUserId({
    userId: customData?.user_id,
    subscriptionId: 'subscriptionId' in data.data && data.data.subscriptionId,
  });
  const con = await createOrGetConnection();
  const flags = await con.getRepository(User).findOne({
    where: { id: userId },
    select: ['subscriptionFlags'],
  });

  return (
    (flags?.subscriptionFlags?.cycle as string) ===
    extractSubscriptionType(data.data?.items)
  );
};

const logPaddleAnalyticsEvent = async (
  data:
    | SubscriptionUpdatedEvent
    | SubscriptionCanceledEvent
    | TransactionCompletedEvent
    | undefined,
  eventName: AnalyticsEventName,
) => {
  if (!data) {
    return;
  }

  const customData = data.data?.customData as { user_id: string };
  const cycle = extractSubscriptionType(data.data?.items);
  const cost = data.data?.items?.[0]?.price?.unitPrice?.amount;
  const currency = data.data?.items?.[0]?.price?.unitPrice?.currencyCode;
  const userId = await getUserId({
    userId: customData?.user_id,
    subscriptionId: 'subscriptionId' in data.data && data.data.subscriptionId,
  });
  if (!userId) {
    return;
  }

  const payment =
    'payments' in data.data &&
    data.data?.payments?.reduce((acc, item) => {
      if (item.status === 'captured') {
        acc = item?.methodDetails?.type || '';
      }
      return acc;
    }, '');

  const extra = {
    cycle,
    cost,
    currency,
    payment,
  };

  await sendAnalyticsEvent([
    {
      event_name: eventName,
      event_timestamp: new Date(data.occurredAt),
      event_id: data?.eventId,
      app_platform: 'api',
      user_id: userId,
      extra: JSON.stringify(extra),
    },
  ]);
};

export const paddle = async (fastify: FastifyInstance): Promise<void> => {
  fastify.register(async (fastify: FastifyInstance): Promise<void> => {
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
                await logPaddleAnalyticsEvent(
                  eventData,
                  AnalyticsEventName.CancelSubscription,
                );
                break;
              case EventName.SubscriptionUpdated:
                if (!(await planChanged(eventData))) {
                  await updateUserSubscription({
                    data: eventData,
                    state: true,
                  });
                  await logPaddleAnalyticsEvent(
                    eventData,
                    AnalyticsEventName.ChangeBillingCycle,
                  );
                }
                break;
              case EventName.TransactionCompleted:
                await logPaddleAnalyticsEvent(
                  eventData,
                  AnalyticsEventName.ReceivePayment,
                );
                break;
              default:
                logger.info({ type: 'paddle' }, eventData?.eventType);
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
