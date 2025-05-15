import {
  type Environment,
  LogLevel,
  Paddle,
  type Subscription,
  type SubscriptionCanceledEvent,
  SubscriptionCreatedNotification,
  SubscriptionNotification,
  type SubscriptionUpdatedEvent,
  type TransactionCompletedEvent,
  type TransactionCreatedEvent,
  type TransactionPaidEvent,
  TransactionPaymentFailedEvent,
  type TransactionUpdatedEvent,
} from '@paddle/paddle-node-sdk';
import { logger } from '../../logger';
import { PricingPreviewLineItem } from '@paddle/paddle-node-sdk/dist/types/entities/pricing-preview';
import { remoteConfig } from '../../remoteConfig';
import { z } from 'zod';
import { UserTransaction } from '../../entity/user/UserTransaction';
import { IsNull, type DataSource, type EntityManager } from 'typeorm';
import { SubscriptionProvider, UserSubscriptionStatus } from '../../entity';
import { isProd } from '../utils';
import { ClaimableItemTypes } from '../../entity/ClaimableItem';
import { ClaimableItem } from '../../entity/ClaimableItem';
import { SubscriptionCycles, type PaddleSubscriptionEvent } from '../../paddle';

export const paddleInstance = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENVIRONMENT as Environment,
  logLevel: isProd ? LogLevel.error : LogLevel.verbose,
});

type CancelSubscriptionProps = {
  subscriptionId: string;
};
export const cancelSubscription = async ({
  subscriptionId,
}: CancelSubscriptionProps): Promise<Subscription | undefined> => {
  try {
    return await paddleInstance.subscriptions.cancel(subscriptionId, {
      effectiveFrom: null,
    });
  } catch (e) {
    logger.error(
      {
        provider: SubscriptionProvider.Paddle,
        subscriptionId,
        err: e,
      },
      'Subscription cancellation failed',
    );
    throw e;
  }
};

export const removeNonNumber = (value: string): string =>
  value.replace(/,(\d{2})$/, '.$1').replace(/[^\d.]/g, '');

export const getPriceFromPaddleItem = (
  item: PricingPreviewLineItem,
): number => {
  const priceAmount = parseFloat(item.totals.total);
  const priceAmountFormatted = parseFloat(
    removeNonNumber(item.formattedTotals.total),
  );

  if (priceAmount === priceAmountFormatted) {
    return priceAmount;
  }

  return priceAmount / 100;
};

export enum ProductPurchaseType {
  Plus = 'plus',
  Core = 'core',
}

export const getProductPurchaseType = ({
  id,
}: {
  id: string;
}): ProductPurchaseType => {
  if (!remoteConfig.vars.coreProductId) {
    throw new Error('Core product id is not set');
  }

  switch (id) {
    case remoteConfig.vars.coreProductId:
      return ProductPurchaseType.Core;
    default:
      return ProductPurchaseType.Plus;
  }
};

const paddleNotificationCustomDataSchema = z.object(
  {
    user_id: z.string({ message: 'Transaction user id is required' }),
  },
  {
    message: 'Transaction custom data is required',
  },
);

export const coreProductCustomDataSchema = z.object(
  {
    cores: z.preprocess(
      (value) => +(value as string),
      z.number().int({ message: 'Cores must be an integer' }),
    ),
  },
  {
    message: 'Transaction product custom data is required',
  },
);

const paddleTransactionSchema = z.object({
  id: z.string({ message: 'Transaction id is required' }),
  updatedAt: z.preprocess(
    (value) => new Date(value as string),
    z.date({ message: 'Transaction updated at is required' }),
  ),
  items: z
    .array(
      z.object({
        price: z.object({
          productId: z.string({
            message: 'Transaction product id is required',
          }),
          customData: coreProductCustomDataSchema,
        }),
      }),
      {
        message: 'Transaction items are required',
      },
    )
    .max(1, 'Multiple items in transaction not supported yet'),
  customData: paddleNotificationCustomDataSchema,
  discountId: z.string().optional().nullable(),
});

export const isCoreTransaction = ({
  event,
}: {
  event:
    | TransactionCreatedEvent
    | TransactionUpdatedEvent
    | TransactionPaidEvent
    | TransactionCompletedEvent
    | TransactionPaymentFailedEvent
    | SubscriptionUpdatedEvent
    | SubscriptionCanceledEvent;
}): boolean => {
  return event.data.items.some(
    (item) =>
      item.price?.productId &&
      getProductPurchaseType({ id: item.price.productId }) ===
        ProductPurchaseType.Core,
  );
};

export const getPaddleTransactionData = ({
  event,
}: {
  event:
    | TransactionCreatedEvent
    | TransactionUpdatedEvent
    | TransactionPaidEvent
    | TransactionCompletedEvent
    | TransactionPaymentFailedEvent;
}): z.infer<typeof paddleTransactionSchema> => {
  const transactionDataResult = paddleTransactionSchema.safeParse(event.data);

  if (transactionDataResult.error) {
    throw new Error(transactionDataResult.error.errors[0].message);
  }

  const transactionData = transactionDataResult.data;

  return transactionData;
};

export const getTransactionForProviderId = async ({
  con,
  providerId,
}: {
  con: DataSource | EntityManager;
  providerId: string;
}): Promise<UserTransaction | null> => {
  return con
    .getRepository(UserTransaction)
    .createQueryBuilder('ut')
    .andWhere(`ut.flags->>'providerId' = :providerId`, {
      providerId,
    })
    .getOne();
};

export const extractSubscriptionCycle = (
  items: PaddleSubscriptionEvent['data']['items'],
) => {
  const cycle = items?.[0]?.price?.billingCycle?.interval;

  if (!cycle) {
    return undefined;
  }

  return cycle === 'year'
    ? SubscriptionCycles.Yearly
    : SubscriptionCycles.Monthly;
};

export const insertClaimableItem = async (
  con: DataSource | EntityManager,
  data: SubscriptionNotification | SubscriptionCreatedNotification,
) => {
  const customer = await paddleInstance.customers.get(data.customerId);

  const existingEntries = await con.getRepository(ClaimableItem).find({
    where: {
      email: customer.email,
      claimedAt: IsNull(),
    },
  });

  await con.getRepository(ClaimableItem).insert({
    type: ClaimableItemTypes.Plus,
    email: customer.email,
    flags: {
      cycle: extractSubscriptionCycle(data.items),
      createdAt: data?.startedAt,
      subscriptionId: data?.id,
      provider: SubscriptionProvider.Paddle,
      status: UserSubscriptionStatus.Active,
    },
  });

  if (existingEntries.length > 0) {
    throw new Error(
      `User ${customer.email} already has a claimable subscription`,
    );
  }
};
