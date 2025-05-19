import {
  type Environment,
  type EventEntity,
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
import {
  IsNull,
  JsonContains,
  type DataSource,
  type EntityManager,
} from 'typeorm';
import { type ConnectionManager, User } from '../../entity';
import { SubscriptionProvider, SubscriptionStatus } from '../plus';
import { isProd } from '../utils';
import { ClaimableItem, ClaimableItemTypes } from '../../entity/ClaimableItem';
import {
  SubscriptionCycles,
  type PaddleAnalyticsExtra,
  type PaddleSubscriptionEvent,
} from '../../paddle';
import {
  cio,
  destroyAnonymousFunnelSubscription,
  identifyAnonymousFunnelSubscription,
} from '../../cio';
import {
  sendAnalyticsEvent,
  TargetType,
  type AnalyticsEventName,
} from '../../integrations/analytics';
import createOrGetConnection from '../../db';

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
  PlusOrganization = 'plusOrganization',
  Core = 'core',
}

export const getProductPurchaseType = ({
  id,
}: {
  id?: string;
}): ProductPurchaseType => {
  if (!remoteConfig.vars.coreProductId) {
    throw new Error('Core product id is not set');
  }

  if (!remoteConfig.vars.plusOrganizationProductId) {
    throw new Error('Plus organization product id is not set');
  }

  switch (id) {
    case remoteConfig.vars.coreProductId:
      return ProductPurchaseType.Core;
    case remoteConfig.vars.plusOrganizationProductId:
      return ProductPurchaseType.PlusOrganization;
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
  event: EventEntity;
}): boolean => {
  if ('items' in event.data === false) {
    return false;
  }

  return event.data.items.some(
    (item) =>
      'price' in item &&
      item.price?.productId &&
      getProductPurchaseType({ id: item.price.productId }) ===
        ProductPurchaseType.Core,
  );
};

export const isOrganizationSubscription = ({
  event,
}: {
  event: EventEntity;
}): boolean => {
  if ('items' in event.data === false) {
    return false;
  }
  return event.data.items.some(
    (item) =>
      'price' in item &&
      item.price?.productId &&
      getProductPurchaseType({ id: item.price.productId }) ===
        ProductPurchaseType.PlusOrganization,
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

export const updateClaimableItem = async (
  con: ConnectionManager,
  data: SubscriptionNotification | SubscriptionCreatedNotification,
) => {
  if (data?.status === 'canceled' || data?.scheduledChange?.action === 'cancel')
    return;
  const customer = await paddleInstance.customers.get(data.customerId);

  const existingEntries = await con.getRepository(ClaimableItem).find({
    where: {
      email: customer.email,
      claimedAt: IsNull(),
    },
  });

  if (existingEntries.length > 0) {
    throw new Error(`User already has a claimable subscription`);
  }

  await con.getRepository(ClaimableItem).insert({
    type: ClaimableItemTypes.Plus,
    email: customer.email,
    flags: {
      cycle: extractSubscriptionCycle(data.items),
      createdAt: data.startedAt,
      subscriptionId: data.id,
      provider: SubscriptionProvider.Paddle,
      status: SubscriptionStatus.Active,
    },
  });

  await identifyAnonymousFunnelSubscription({
    cio,
    email: customer.email,
    claimedSub: false,
  });
};

export const dropClaimableItem = async (
  con: ConnectionManager,
  data: SubscriptionNotification,
) => {
  const customer = await paddleInstance.customers.get(data.customerId);

  await con.getRepository(ClaimableItem).delete({
    email: customer.email,
    claimedAt: IsNull(),
    flags: JsonContains({
      subscriptionId: data.id,
    }),
  });

  await destroyAnonymousFunnelSubscription({
    cio,
    email: customer.email,
  });
};

const getAnalyticsExtra = (
  data: (
    | SubscriptionUpdatedEvent
    | SubscriptionCanceledEvent
    | TransactionCompletedEvent
  )['data'],
): Partial<PaddleAnalyticsExtra> => {
  const cost = data.items?.[0]?.price?.unitPrice?.amount;
  const currency = data.items?.[0]?.price?.unitPrice?.currencyCode;
  const localCurrency = data.currencyCode;

  // payments are only available on transaction events
  if (!('payments' in data)) {
    return {
      cycle: extractSubscriptionCycle(data.items),
      cost: cost ? parseInt(cost) / 100 : undefined,
      currency,
      localCurrency,
    };
  }

  const transaction = data as TransactionCompletedEvent['data'];
  const localCost = transaction?.details?.totals?.total;
  const payout = transaction?.details?.payoutTotals;
  const payment = transaction.payments?.reduce((acc, item) => {
    if (item.status === 'captured') {
      acc = item?.methodDetails?.type || '';
    }
    return acc;
  }, '');

  return {
    cost: cost ? parseInt(cost) / 100 : undefined,
    currency,
    payment,
    localCost: localCost ? parseInt(localCost) / 100 : undefined,
    localCurrency,
    payout,
  };
};

export const getUserId = async ({
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
    // for anonymouse subs this will be empty
    return '';
  }

  return user.id;
};

// will always return false for anonymous subscriptions
export const planChanged = async ({ data }: SubscriptionUpdatedEvent) => {
  const customData = data?.customData as { user_id: string };
  const userId = await getUserId({
    userId: customData?.user_id,
    subscriptionId: data?.id,
  });
  const con = await createOrGetConnection();
  const flags = await con.getRepository(User).findOne({
    where: { id: userId },
    select: ['subscriptionFlags'],
  });

  return (
    (flags?.subscriptionFlags?.cycle as string) !==
    extractSubscriptionCycle(data?.items)
  );
};

export const logPaddleAnalyticsEvent = async (
  event:
    | SubscriptionUpdatedEvent
    | SubscriptionCanceledEvent
    | TransactionCompletedEvent
    | undefined,
  eventName: AnalyticsEventName,
) => {
  if (!event) {
    return;
  }

  const { data, occurredAt, eventId } = event;
  const customData = data.customData as { user_id: string };
  const userId = await getUserId({
    userId: customData?.user_id,
    subscriptionId:
      ('subscriptionId' in data && data.subscriptionId) || data.id,
  });

  if (!userId) {
    return;
  }

  await sendAnalyticsEvent([
    {
      event_name: eventName,
      event_timestamp: new Date(occurredAt),
      event_id: eventId,
      app_platform: 'api',
      user_id: userId,
      extra: JSON.stringify(getAnalyticsExtra(data)),
      target_type: isCoreTransaction({ event })
        ? TargetType.Credits
        : TargetType.Plus,
    },
  ]);
};

export interface PaddleCustomData {
  user_id?: string;
  gifter_id?: string;
}
