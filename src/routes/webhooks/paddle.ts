import { FastifyInstance } from 'fastify';
import {
  EventName,
  type SubscriptionCanceledEvent,
  type SubscriptionCreatedEvent,
  type SubscriptionItemNotification,
  type SubscriptionUpdatedEvent,
  type TransactionCompletedEvent,
  type TransactionItemNotification,
} from '@paddle/paddle-node-sdk';
import createOrGetConnection from '../../db';
import {
  updateFlagsStatement,
  updateSubscriptionFlags,
  webhooks,
} from '../../common';
import {
  SubscriptionProvider,
  User,
  UserSubscriptionStatus,
} from '../../entity';
import { logger } from '../../logger';
import { remoteConfig } from '../../remoteConfig';
import {
  AnalyticsEventName,
  sendAnalyticsEvent,
} from '../../integrations/analytics';
import { JsonContains } from 'typeorm';
import { paddleInstance } from '../../common/paddle';
import { addMilliseconds } from 'date-fns';
import {
  isPlusMember,
  plusGiftDuration,
  SubscriptionCycles,
} from '../../paddle';

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

export interface PaddleCustomData {
  user_id?: string;
  gifter_id?: string;
}

export const updateUserSubscription = async ({
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

  const customData: PaddleCustomData = data.data?.customData ?? {};

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
        provider: state ? SubscriptionProvider.Paddle : null,
        status: state ? UserSubscriptionStatus.Active : null,
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
    subscriptionId: data.data?.id,
  });
  const con = await createOrGetConnection();
  const flags = await con.getRepository(User).findOne({
    where: { id: userId },
    select: ['subscriptionFlags'],
  });

  return (
    (flags?.subscriptionFlags?.cycle as string) !==
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
  const localCost = (data as TransactionCompletedEvent).data?.details?.totals
    ?.total;
  const localCurrency = data.data?.currencyCode;
  const payout = (data as TransactionCompletedEvent).data?.details
    ?.payoutTotals;
  const userId = await getUserId({
    userId: customData?.user_id,
    subscriptionId:
      ('subscriptionId' in data.data && data.data.subscriptionId) ||
      data.data.id,
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
    cost: cost ? parseInt(cost) / 100 : undefined,
    currency,
    payment,
    localCost: localCost ? parseInt(localCost) / 100 : undefined,
    localCurrency,
    payout,
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

const concatText = (a: string, b: string) => [a, b].filter(Boolean).join(`\n`);
const notifyNewPaddleTransaction = async ({
  event: { data },
}: {
  event: TransactionCompletedEvent;
}) => {
  const { user_id, gifter_id } = (data?.customData ?? {}) as PaddleCustomData;
  const purchasedById = gifter_id ?? user_id;
  const subscriptionForId = await getUserId({
    userId: user_id,
    subscriptionId: 'subscriptionId' in data && data.subscriptionId,
  });
  const con = await createOrGetConnection();
  const flags = gifter_id
    ? (
        await con.getRepository(User).findOne({
          select: ['subscriptionFlags'],
          where: { id: subscriptionForId },
        })
      )?.subscriptionFlags
    : null;

  if (gifter_id && !flags?.giftExpirationDate) {
    logger.error(
      { type: 'paddle' },
      'Gifted subscription without expiration date',
    );
  }

  const origin = data?.origin;
  const productId = data?.items?.[0].price?.productId;

  const total = data?.items?.[0]?.price?.unitPrice?.amount || '0';
  const currencyCode =
    data?.items?.[0]?.price?.unitPrice?.currencyCode || 'USD';

  const localTotal = data?.details?.totals?.total || '0';
  const localCurrencyCode = data?.currencyCode || 'USD';

  if (origin === 'subscription_recurring') {
    return;
  }

  const headerText = (() => {
    if (gifter_id) {
      return 'Gift subscription :gift:';
    }

    return 'New Plus subscriber :moneybag:';
  })();

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatText(
            '*Transaction ID:*',
            `<https://vendors.paddle.com/transactions-v2/${data.id}|${data.id}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatText(
            '*Customer ID:*',
            `<https://vendors.paddle.com/customers-v2/${data.customerId}|${data.customerId}>`,
          ),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatText(
            '*Type:*',
            `<https://vendors.paddle.com/products-v2/${productId}|${extractSubscriptionType(data?.items)}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatText(
            '*Purchased by:*',
            `<https://app.daily.dev/${purchasedById}|${purchasedById}>`,
          ),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatText(
            '*Cost:*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currencyCode,
            }).format((parseFloat(total) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatText('*Currency:*', currencyCode),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatText(
            '*Cost (local):*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: localCurrencyCode,
            }).format((parseFloat(localTotal) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatText('*Currency (local):*', localCurrencyCode),
        },
      ],
    },
  ];

  if (gifter_id && flags?.giftExpirationDate) {
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatText(
            '*Gifted to:*',
            `<https://app.daily.dev/${subscriptionForId}|${subscriptionForId}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatText(
            '*Gift expires:*',
            new Date(flags.giftExpirationDate).toLocaleDateString(),
          ),
        },
      ],
    });
  }

  await webhooks.transactions.send({ blocks });
};

export const processGiftedPayment = async ({
  event: { data },
}: {
  event: TransactionCompletedEvent;
}) => {
  const con = await createOrGetConnection();
  const { gifter_id, user_id } = data.customData as PaddleCustomData;

  if (user_id === gifter_id) {
    logger.error({ type: 'paddle', data }, 'User and gifter are the same');
    return;
  }

  const gifterUser = await con.getRepository(User).findOneBy({ id: gifter_id });

  if (!gifterUser) {
    logger.error({ type: 'paddle', data }, 'Gifter user not found');
    return;
  }

  const targetUser = await con.getRepository(User).findOne({
    select: ['subscriptionFlags'],
    where: { id: user_id },
  });

  if (isPlusMember(targetUser?.subscriptionFlags?.cycle)) {
    logger.error({ type: 'paddle', data }, 'User is already a Plus member');
    return;
  }

  await con.getRepository(User).update(
    { id: user_id },
    {
      subscriptionFlags: updateSubscriptionFlags({
        cycle: SubscriptionCycles.Yearly,
        createdAt: data?.createdAt,
        subscriptionId: data?.id,
        gifterId: gifter_id,
        giftExpirationDate: addMilliseconds(
          new Date(),
          plusGiftDuration,
        ).toISOString(),
        provider: SubscriptionProvider.Paddle,
      }),
      flags: updateFlagsStatement({ showPlusGift: true }),
    },
  );
};

export const processTransactionCompleted = async ({
  event,
}: {
  event: TransactionCompletedEvent;
}) => {
  const { gifter_id } = (event?.data?.customData ?? {}) as PaddleCustomData;

  if (gifter_id) {
    await processGiftedPayment({ event });
  }

  await notifyNewPaddleTransaction({ event });
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
            const eventData = await paddleInstance.webhooks.unmarshal(
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
                Promise.all([
                  updateUserSubscription({
                    data: eventData,
                    state: false,
                  }),
                  logPaddleAnalyticsEvent(
                    eventData,
                    AnalyticsEventName.CancelSubscription,
                  ),
                ]);
                break;
              case EventName.SubscriptionUpdated:
                const didPlanChange = await planChanged(eventData);
                if (didPlanChange) {
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
                await Promise.all([
                  logPaddleAnalyticsEvent(
                    eventData,
                    AnalyticsEventName.ReceivePayment,
                  ),
                  processTransactionCompleted({ event: eventData }),
                ]);
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
