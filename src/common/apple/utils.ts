import {
  AccountTenure,
  NotificationTypeV2,
  Subtype,
  type Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
  type SignedDataVerifier,
} from '@apple/app-store-server-library';
import { logger } from '../../logger';
import { type User } from '../../entity/user/User';
import { isNullOrUndefined } from '../object';
import {
  AnalyticsEventName,
  sendAnalyticsEvent,
  TargetType,
} from '../../integrations/analytics';
import {
  AppleTransactionType,
  certificatesToLoad,
  productIdToCycle,
} from './types';
import { readFile } from 'fs/promises';
import { isTest } from '../utils';
import { isCorePurchaseApple } from './purchase';
import { SubscriptionProvider } from '../plus';
import { differenceInDays } from 'date-fns';

export const verifyAndDecodeAppleSignedData = async ({
  notification,
  verifier,
}: {
  notification: ResponseBodyV2DecodedPayload;
  environment: Environment;
  verifier: SignedDataVerifier;
}): Promise<{
  transactionInfo?: JWSTransactionDecodedPayload;
  renewalInfo?: JWSRenewalInfoDecodedPayload;
}> => {
  let renewalInfo: JWSRenewalInfoDecodedPayload | undefined = undefined;
  let transactionInfo: JWSTransactionDecodedPayload | undefined = undefined;

  if (!isNullOrUndefined(notification.data?.signedRenewalInfo)) {
    renewalInfo = await verifier.verifyAndDecodeRenewalInfo(
      notification.data.signedRenewalInfo,
    );
  }

  if (!isNullOrUndefined(notification.data?.signedTransactionInfo)) {
    transactionInfo = await verifier.verifyAndDecodeTransaction(
      notification.data.signedTransactionInfo,
    );
  }

  return {
    transactionInfo,
    renewalInfo,
  };
};

export const logAppleAnalyticsEvent = async (
  transactionInfo: JWSTransactionDecodedPayload,
  renewalInfo: JWSRenewalInfoDecodedPayload | undefined,
  eventName: AnalyticsEventName,
  user: Pick<User, 'id' | 'subscriptionFlags' | 'coresRole'>,
  currencyInUSD: number,
) => {
  if (!transactionInfo || isTest) {
    return;
  }

  const cycle =
    productIdToCycle[
      renewalInfo?.autoRenewProductId as keyof typeof productIdToCycle
    ];
  const cost = renewalInfo?.renewalPrice;

  const extra = {
    payment: SubscriptionProvider.AppleStoreKit,
    cycle,
    cost: currencyInUSD,
    currency: 'USD',
    localCost: cost ? cost / 1000 : undefined,
    localCurrency: transactionInfo?.currency,
    payout: {
      total: currencyInUSD * 100,
      grandTotal: currencyInUSD * 100,
      currencyCode: 'USD',
    },
  };

  await sendAnalyticsEvent([
    {
      event_name: eventName,
      event_timestamp: new Date(transactionInfo?.signedDate || ''),
      event_id: transactionInfo.transactionId,
      app_platform: 'api',
      user_id: user.id,
      extra: JSON.stringify(extra),
      target_type: isCorePurchaseApple({ transactionInfo })
        ? TargetType.Credits
        : TargetType.Plus,
    },
  ]);
};

export const getAnalyticsEventFromAppleNotification = (
  notificationType: ResponseBodyV2DecodedPayload['notificationType'],
  subtype?: ResponseBodyV2DecodedPayload['subtype'],
): AnalyticsEventName | null => {
  switch (notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.ONE_TIME_CHARGE:
      return AnalyticsEventName.ReceivePayment;
    case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
      return AnalyticsEventName.ChangeBillingCycle;
    case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS: // Disable/Enable Auto-Renew
      return subtype === Subtype.AUTO_RENEW_ENABLED
        ? null
        : AnalyticsEventName.CancelSubscription;
    case NotificationTypeV2.DID_FAIL_TO_RENEW:
      // When user fails to renew and there is no grace period
      if (isNullOrUndefined(subtype)) {
        return AnalyticsEventName.CancelSubscription;
      }
    default:
      return null;
  }
};

export const loadAppleRootCAs = async (): Promise<Buffer[]> => {
  const appleRootCAs: Buffer[] = await Promise.all(
    certificatesToLoad.map(async (certPath) => await readFile(certPath)),
  );

  logger.debug(`Loaded ${appleRootCAs.length} Apple's Root CAs`);
  return appleRootCAs;
};

export const getAppleTransactionType = ({
  transactionInfo,
}: {
  transactionInfo: JWSTransactionDecodedPayload;
}): AppleTransactionType | null => {
  switch (transactionInfo.type) {
    case 'Auto-Renewable Subscription':
      return AppleTransactionType.AutoRenewableSubscription;
    case 'Non-Consumable':
      return AppleTransactionType.NonConsumable;
    case 'Consumable':
      return AppleTransactionType.Consumable;
    case 'Non-Renewing Subscription':
      return AppleTransactionType.NonRenewingSubscription;
    default:
      return null;
  }
};

export const getAccountTenure = (user: Pick<User, 'createdAt'>): number => {
  if (!user.createdAt) {
    return 0;
  }

  const difference = differenceInDays(new Date(), user.createdAt);

  if (difference < 3) return AccountTenure.ZERO_TO_THREE_DAYS;
  if (difference < 10) return AccountTenure.THREE_DAYS_TO_TEN_DAYS;
  if (difference < 30) return AccountTenure.TEN_DAYS_TO_THIRTY_DAYS;
  if (difference < 90) return AccountTenure.THIRTY_DAYS_TO_NINETY_DAYS;
  if (difference < 180)
    return AccountTenure.NINETY_DAYS_TO_ONE_HUNDRED_EIGHTY_DAYS;
  if (difference < 365)
    return AccountTenure.ONE_HUNDRED_EIGHTY_DAYS_TO_THREE_HUNDRED_SIXTY_FIVE_DAYS;
  return AccountTenure.GREATER_THAN_THREE_HUNDRED_SIXTY_FIVE_DAYS;
};
