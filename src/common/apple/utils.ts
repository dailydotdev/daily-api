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
  renewalInfo: JWSRenewalInfoDecodedPayload,
  eventName: AnalyticsEventName,
  user: User,
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
      event_id: transactionInfo.appTransactionId,
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
