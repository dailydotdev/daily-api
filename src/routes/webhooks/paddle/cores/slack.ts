import type { TransactionCompletedEvent } from '@paddle/paddle-node-sdk';
import type { getPaddleTransactionData } from '../../../../common/paddle';
import type { UserTransaction } from '../../../../entity/user/UserTransaction';
import { concatTextToNewline } from '../../../../common/utils';
import { webhooks } from '../../../../common/slack';

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
