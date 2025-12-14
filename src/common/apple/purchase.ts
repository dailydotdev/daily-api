import {
  AppStoreServerAPIClient,
  ConsumptionStatus,
  DeliveryStatus,
  Environment,
  JWSTransactionDecodedPayload,
  LifetimeDollarsPurchased,
  LifetimeDollarsRefunded,
  Platform,
  PlayTime,
  ResponseBodyV2DecodedPayload,
  UserStatus,
  type ConsumptionRequest,
} from '@apple/app-store-server-library';
import { RefundPreference } from '@apple/app-store-server-library/dist/models/RefundPreference';
import { JsonContains } from 'typeorm';
import type { User } from '../../entity/user/User';
import {
  getAccountTenure,
  getAnalyticsEventFromAppleNotification,
  getAppleTransactionType,
  logAppleAnalyticsEvent,
} from './utils';
import {
  appleAppStoreServerClientKey,
  appleAppStoreServerClientKeyId,
  appleIssuerId,
  AppleTransactionType,
  bundleId,
} from './types';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../entity/user/UserTransaction';
import createOrGetConnection from '../../db';
import { purchaseCores, UserTransactionError } from '../njord';
import { TransferError } from '../../errors';
import { concatTextToNewline, isTest, updateFlagsStatement } from '../utils';
import type { Block, KnownBlock } from '@slack/web-api';
import { webhooks } from '../slack';
import { checkUserCoresAccess } from '../user';
import { CoresRole } from '../../types';
import { convertCurrencyToUSD } from '../../integrations/openExchangeRates';
import {
  DEFAULT_CORES_METADATA,
  getCoresPricingMetadata,
} from '../paddle/pricing';

export const isCorePurchaseApple = ({
  transactionInfo,
}: {
  transactionInfo: JWSTransactionDecodedPayload;
}) => {
  return (
    getAppleTransactionType({ transactionInfo }) ===
      AppleTransactionType.Consumable &&
    !!transactionInfo.productId?.startsWith('cores_')
  );
};

export const notifyNewStoreKitPurchase = async ({
  data,
  transaction,
  user,
  currencyInUSD,
}: {
  data: JWSTransactionDecodedPayload;
  transaction: UserTransaction;
  user: Pick<User, 'id' | 'subscriptionFlags' | 'coresRole'>;
  currencyInUSD: number;
}) => {
  if (isTest) {
    return;
  }

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Cores purchased :cores: :apple-ico:',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Transaction ID:*', data.transactionId),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*App Account Token:*',
            data.appAccountToken,
          ),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Product:*', data.productId),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Cores:*', transaction.value.toString()),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Purchased by:*',
            `<https://app.daily.dev/${user.id}|${user.id}>`,
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
              currency: 'USD',
            }).format(currencyInUSD || 0),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency:*', 'USD'),
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
              currency: data.currency,
            }).format((data.price || 0) / 1000),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency (local):*', data.currency),
        },
      ],
    },
  ];

  await webhooks.transactions.send({ blocks });
};

export const handleCoresPurchase = async ({
  transactionInfo,
  user,
  notification,
  environment,
}: {
  transactionInfo: JWSTransactionDecodedPayload;
  user: Pick<User, 'id' | 'subscriptionFlags' | 'coresRole'>;
  environment: Environment;
  notification: ResponseBodyV2DecodedPayload;
}): Promise<UserTransaction> => {
  if (!transactionInfo.transactionId) {
    throw new Error('Missing transactionId in transactionInfo');
  }

  if (!transactionInfo.productId) {
    throw new Error('Missing productId in transactionInfo');
  }

  if (
    checkUserCoresAccess({
      user,
      requiredRole: CoresRole.User,
    }) === false
  ) {
    throw new Error('User does not have access to cores purchase');
  }

  const con = await createOrGetConnection();

  const coresMetadata = await getCoresPricingMetadata({
    con,
    variant: DEFAULT_CORES_METADATA,
  });

  const coresValue = coresMetadata.find(
    (item) => item.idMap.ios === transactionInfo.productId,
  )?.coresValue;

  if (typeof coresValue !== 'number') {
    throw new Error('Could not resolve Cores value for product');
  }

  const payload = con.getRepository(UserTransaction).create({
    processor: UserTransactionProcessor.AppleStoreKit,
    receiverId: user.id,
    status: UserTransactionStatus.Success,
    productId: null, // no product user is buying cores directly
    senderId: null, // no sender, user is buying cores
    value: coresValue,
    valueIncFees: coresValue,
    fee: 0, // no fee when buying cores
    request: {},
    flags: {
      providerId: transactionInfo.transactionId,
    },
  });

  const transaction = await con.transaction(async (entityManager) => {
    const userTransaction = await entityManager
      .getRepository(UserTransaction)
      .save(payload);

    // skip assigning Cores in sandbox environment
    if (environment !== Environment.SANDBOX) {
      try {
        await purchaseCores({
          transaction: userTransaction,
        });
      } catch (error) {
        if (error instanceof TransferError) {
          const userTransactionError = new UserTransactionError({
            status: error.transfer.status,
            transaction: userTransaction,
          });

          // update transaction status to error
          await entityManager.getRepository(UserTransaction).update(
            {
              id: userTransaction.id,
            },
            {
              status: error.transfer.status as number,
              flags: updateFlagsStatement<UserTransaction>({
                error: userTransactionError.message,
              }),
            },
          );

          return entityManager.getRepository(UserTransaction).create({
            ...userTransaction,
            status: error.transfer.status as number,
            flags: {
              ...userTransaction.flags,
              error: userTransactionError.message,
            },
          });
        }

        throw error;
      }
    }

    return userTransaction;
  });

  const currencyInUSD = await convertCurrencyToUSD(
    (transactionInfo.price || 0) / 1000,
    transactionInfo.currency || 'USD',
  );

  const eventName = getAnalyticsEventFromAppleNotification(
    notification.notificationType,
    notification.subtype,
  );

  if (eventName) {
    await logAppleAnalyticsEvent(
      transactionInfo,
      undefined,
      eventName,
      user,
      currencyInUSD,
    );
  }

  if (transaction.status === UserTransactionStatus.Success) {
    await notifyNewStoreKitPurchase({
      data: transactionInfo,
      transaction,
      user,
      currencyInUSD,
    });
  }

  return transaction;
};

export const handleCoresConsumptionRequest = async ({
  transactionInfo,
  user,
  environment,
}: {
  transactionInfo: JWSTransactionDecodedPayload;
  user: Pick<User, 'id' | 'subscriptionFlags' | 'coresRole' | 'createdAt'>;
  environment: Environment;
}) => {
  if (!transactionInfo.transactionId) {
    throw new Error('Missing transactionId in transactionInfo');
  }

  if (!user.subscriptionFlags?.appAccountToken) {
    throw new Error('Missing appAccountToken in user subscription flags');
  }

  const apiClient = new AppStoreServerAPIClient(
    appleAppStoreServerClientKey,
    appleAppStoreServerClientKeyId,
    appleIssuerId,
    bundleId,
    environment,
  );

  const con = await createOrGetConnection();

  const deliveryStatus = await con.getRepository(UserTransaction).exists({
    where: {
      receiverId: user.id,
      flags: JsonContains({ providerId: transactionInfo.transactionId }),
    },
  });

  const consumptionRequest: ConsumptionRequest = {
    accountTenure: getAccountTenure(user),
    appAccountToken: user.subscriptionFlags.appAccountToken,
    consumptionStatus: ConsumptionStatus.FULLY_CONSUMED, // It is assumed that the user has fully consumed the in-app purchase
    customerConsented: true,
    deliveryStatus: deliveryStatus
      ? DeliveryStatus.DELIVERED_AND_WORKING_PROPERLY
      : DeliveryStatus.DID_NOT_DELIVER_DUE_TO_SERVER_OUTAGE,
    refundPreference: RefundPreference.PREFER_DECLINE,
    userStatus: UserStatus.ACTIVE,

    // Values we don't track or care about, but are required by Apple
    sampleContentProvided: false,
    lifetimeDollarsPurchased: LifetimeDollarsPurchased.UNDECLARED,
    lifetimeDollarsRefunded: LifetimeDollarsRefunded.UNDECLARED,
    platform: Platform.UNDECLARED,
    playTime: PlayTime.UNDECLARED,
  };

  await apiClient.sendConsumptionData(
    transactionInfo.transactionId,
    consumptionRequest,
  );
};
