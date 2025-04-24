import {
  NotificationTypeV2,
  Subtype,
  type Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
  type SignedDataVerifier,
} from '@apple/app-store-server-library';
import { logger } from '../../logger';
import { SubscriptionProvider, type User } from '../../entity/user/User';
import { isNullOrUndefined } from '../object';
import {
  AnalyticsEventName,
  sendAnalyticsEvent,
} from '../../integrations/analytics';
import {
  AppleTransactionType,
  certificatesToLoad,
  productIdToCycle,
} from './types';
import { readFile } from 'fs/promises';
import { isTest } from '../utils';

export const verifyAndDecodeAppleSignedData = async ({
  notification,
  environment,
  verifier,
}: {
  notification: ResponseBodyV2DecodedPayload;
  environment: Environment;
  verifier: SignedDataVerifier;
}) => {
  if (!isNullOrUndefined(notification.data?.signedRenewalInfo)) {
    return await verifier.verifyAndDecodeTransaction(
      notification.data.signedRenewalInfo,
    );
  }

  if (!isNullOrUndefined(notification.data?.signedTransactionInfo)) {
    return await verifier.verifyAndDecodeTransaction(
      notification.data.signedTransactionInfo,
    );
  }

  logger.info(
    {
      environment,
      notification,
      provider: SubscriptionProvider.AppleStoreKit,
    },
    'Missing signed data in notification data',
  );

  return null;
};

export const logAppleAnalyticsEvent = async (
  data: JWSRenewalInfoDecodedPayload,
  eventName: AnalyticsEventName,
  user: User,
  currencyInUSD: number,
) => {
  if (!data || isTest) {
    return;
  }

  const cycle =
    productIdToCycle[data?.autoRenewProductId as keyof typeof productIdToCycle];
  const cost = data?.renewalPrice;

  const extra = {
    payment: SubscriptionProvider.AppleStoreKit,
    cycle,
    cost: currencyInUSD,
    currency: 'USD',
    localCost: cost ? cost / 1000 : undefined,
    localCurrency: data?.currency,
    payout: {
      total: currencyInUSD * 100,
      grandTotal: currencyInUSD * 100,
      currencyCode: 'USD',
    },
  };

  await sendAnalyticsEvent([
    {
      event_name: eventName,
      event_timestamp: new Date(data?.signedDate || ''),
      event_id: data.appTransactionId,
      app_platform: 'api',
      user_id: user.id,
      extra: JSON.stringify(extra),
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
  decodedInfo,
}: {
  decodedInfo: JWSTransactionDecodedPayload;
}): AppleTransactionType | null => {
  switch (decodedInfo.type) {
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
