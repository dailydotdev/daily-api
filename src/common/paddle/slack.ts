import type { TransactionCompletedEvent } from '@paddle/paddle-node-sdk';
import {
  getUserId,
  type getPaddleTransactionData,
  type PaddleCustomData,
} from '../../common/paddle';
import type { UserTransaction } from '../../entity/user/UserTransaction';
import { concatTextToNewline } from '../../common/utils';
import { webhooks } from '../../common/slack';
import createOrGetConnection from '../../db';
import { User } from '../../entity/user/User';
import { SubscriptionProvider } from '../plus';
import { logger } from '../../logger';
import { Organization } from '../../entity';
import { JsonContains } from 'typeorm';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';

export const notifyNewPaddleCoresTransaction = async ({
  data,
  transaction,
  event,
}: {
  data: ReturnType<typeof getPaddleTransactionData>;
  transaction: UserTransaction;
  event: TransactionCompletedEvent;
}) => {
  const purchasedById = data.customData.user_id;

  const currencyCode =
    event?.data?.items?.[0]?.price?.unitPrice?.currencyCode || 'USD';

  const total = event?.data?.items?.[0]?.price?.unitPrice?.amount || '0';
  const localTotal = event?.data?.details?.totals?.total || '0';
  const localCurrencyCode = event?.data?.currencyCode || 'USD';

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Cores purchased :cores:',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Transaction ID:*',
            `<https://vendors.paddle.com/transactions-v2/${data.id}|${data.id}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Customer ID:*',
            `<https://vendors.paddle.com/customers-v2/${event.data.customerId}|${event.data.customerId}>`,
          ),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Cores:*', transaction.value.toString()),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
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
          text: concatTextToNewline(
            '*Cost:*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currencyCode,
            }).format((parseFloat(total) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency:*', currencyCode),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost (local):*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: localCurrencyCode,
            }).format((parseFloat(localTotal) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency (local):*', localCurrencyCode),
        },
      ],
    },
  ];

  await webhooks.transactions.send({ blocks });
};

export const notifyNewPaddlePlusTransaction = async ({
  event,
}: {
  event: TransactionCompletedEvent;
}) => {
  const { data } = event;
  const { customData, subscriptionId } = data ?? {};
  const { user_id, gifter_id } = (customData ?? {}) as PaddleCustomData;
  const purchasedById = gifter_id ?? user_id;
  const subscriptionForId = await getUserId({
    userId: user_id,
    subscriptionId,
  });
  const con = await createOrGetConnection();
  const flags = (
    await con.getRepository(User).findOne({
      select: ['subscriptionFlags'],
      where: { id: subscriptionForId },
    })
  )?.subscriptionFlags;

  if (gifter_id && !flags?.giftExpirationDate) {
    logger.error(
      { provider: SubscriptionProvider.Paddle, data: event },
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
      return 'Gift subscription :gift: :paddle:';
    }

    return 'New Plus subscriber :moneybag: :paddle:';
  })();

  const subscriptionCycle =
    flags?.cycle || data.billingDetails?.paymentTerms.interval;

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
          text: concatTextToNewline(
            '*Transaction ID:*',
            `<https://vendors.paddle.com/transactions-v2/${data.id}|${data.id}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
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
          text: concatTextToNewline(
            '*Type:*',
            `<https://vendors.paddle.com/products-v2/${productId}|${subscriptionCycle}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Purchased by:*',
            purchasedById
              ? `<https://app.daily.dev/${purchasedById}|${purchasedById}>`
              : 'anonymous',
          ),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost:*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currencyCode,
            }).format((parseFloat(total) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency:*', currencyCode),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost (local):*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: localCurrencyCode,
            }).format((parseFloat(localTotal) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency (local):*', localCurrencyCode),
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
          text: concatTextToNewline(
            '*Gifted to:*',
            `<https://app.daily.dev/${subscriptionForId}|${subscriptionForId}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Gift expires:*',
            new Date(flags.giftExpirationDate).toLocaleDateString(),
          ),
        },
      ],
    });
  }

  await webhooks.transactions.send({ blocks });
};

export const notifyNewPaddleOrganizationTransaction = async ({
  event,
}: {
  event: TransactionCompletedEvent;
}) => {
  const con = await createOrGetConnection();

  const { data } = event;
  const { customData } = data ?? {};

  const { user_id: purchasedById } = (customData ?? {}) as PaddleCustomData;
  const organization = await con.getRepository(Organization).findOneByOrFail({
    subscriptionFlags: JsonContains({
      subscriptionId: data.subscriptionId,
    }),
  });
  const flags = organization?.subscriptionFlags;

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

  const subscriptionCycle =
    flags?.cycle || data.billingDetails?.paymentTerms.interval;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'New Organization subscription :office: :paddle:',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Transaction ID:*',
            `<https://vendors.paddle.com/transactions-v2/${data.id}|${data.id}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
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
          text: concatTextToNewline(
            '*Type:*',
            `<https://vendors.paddle.com/products-v2/${productId}|${subscriptionCycle}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
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
          text: concatTextToNewline('*Organization:*', organization.name),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Seats:*', organization.seats.toString()),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost:*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currencyCode,
            }).format((parseFloat(total) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency:*', currencyCode),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost (local):*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: localCurrencyCode,
            }).format((parseFloat(localTotal) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency (local):*', localCurrencyCode),
        },
      ],
    },
  ];

  await webhooks.transactions.send({ blocks });
};

export const notifyNewPaddleRecruiterTransaction = async ({
  event,
}: {
  event: TransactionCompletedEvent;
}) => {
  const con = await createOrGetConnection();

  const { data } = event;
  const { customData } = data ?? {};

  const { user_id: purchasedById } = (customData ?? {}) as PaddleCustomData;
  const opportunity = await con.getRepository(OpportunityJob).findOneOrFail({
    where: {
      subscriptionFlags: JsonContains({
        subscriptionId: data.subscriptionId,
      }),
    },
    relations: {
      organization: true,
    },
  });
  const flags = opportunity?.subscriptionFlags;

  const origin = data?.origin;
  const productId = data?.items?.[0].price?.productId;

  const total = data?.items?.[0]?.price?.unitPrice?.amount || '0';
  const currencyCode =
    data?.items?.[0]?.price?.unitPrice?.currencyCode || 'USD';

  const localTotal = data?.details?.totals?.total || '0';
  const localCurrencyCode = data?.currencyCode || 'USD';

  const organization = await opportunity.organization;

  if (origin === 'subscription_recurring') {
    return;
  }

  const subscriptionCycle =
    flags?.cycle || data.billingDetails?.paymentTerms.interval;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'New job subscription :tears-of-joy-office: :paddle:',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Transaction ID:*',
            `<https://vendors.paddle.com/transactions-v2/${data.id}|${data.id}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
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
          text: concatTextToNewline(
            '*Type:*',
            `<https://vendors.paddle.com/products-v2/${productId}|${subscriptionCycle}>`,
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
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
          text: concatTextToNewline(
            '*Organization:*',
            organization?.name || 'Unknown',
          ),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost:*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currencyCode,
            }).format((parseFloat(total) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency:*', currencyCode),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost (local):*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: localCurrencyCode,
            }).format((parseFloat(localTotal) || 0) / 100),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency (local):*', localCurrencyCode),
        },
      ],
    },
  ];

  await webhooks.transactions.send({ blocks });
};
