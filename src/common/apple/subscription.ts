import {
  NotificationTypeV2,
  Subtype,
  type Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import { logger } from '../../logger';
import {
  SubscriptionProvider,
  UserSubscriptionStatus,
  type User,
  type UserSubscriptionFlags,
} from '../../entity/user/User';
import { convertCurrencyToUSD } from '../../integrations/openExchangeRates';
import { updateStoreKitUserSubscription } from '../../plusSubscription';
import { isNullOrUndefined } from '../object';
import {
  getAnalyticsEventFromAppleNotification,
  logAppleAnalyticsEvent,
} from './utils';
import { notifyNewStoreKitSubscription } from '../../routes/webhooks/apple';
import { productIdToCycle } from './types';

const getSubscriptionStatus = (
  notificationType: ResponseBodyV2DecodedPayload['notificationType'],
  subtype?: ResponseBodyV2DecodedPayload['subtype'],
): UserSubscriptionStatus => {
  switch (notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF: // Upgrade/Downgrade
    case NotificationTypeV2.REFUND_REVERSED:
      return UserSubscriptionStatus.Active;
    case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS: // Disable/Enable Auto-Renew
      return subtype === Subtype.AUTO_RENEW_ENABLED
        ? UserSubscriptionStatus.Active
        : UserSubscriptionStatus.Cancelled;
    case NotificationTypeV2.DID_FAIL_TO_RENEW:
      // When user fails to renew and there is no grace period
      if (isNullOrUndefined(subtype)) {
        return UserSubscriptionStatus.Cancelled;
      }
    case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
      return UserSubscriptionStatus.Cancelled;
    case NotificationTypeV2.REFUND:
    case NotificationTypeV2.EXPIRED:
    case NotificationTypeV2.REVOKE: // We don't support Family Sharing, but to be on the safe side
      return UserSubscriptionStatus.Expired;
    default:
      logger.error(
        {
          notificationType,
          subtype,
          provider: SubscriptionProvider.AppleStoreKit,
        },
        'Unknown notification type',
      );
      throw new Error('Unknown notification type');
  }
};

const renewalInfoToSubscriptionFlags = (
  data: JWSRenewalInfoDecodedPayload,
): UserSubscriptionFlags => {
  const cycle =
    productIdToCycle[data.autoRenewProductId as keyof typeof productIdToCycle];

  if (isNullOrUndefined(cycle)) {
    logger.error(
      { data, provider: SubscriptionProvider.AppleStoreKit },
      'Invalid auto renew product ID',
    );
    throw new Error('Invalid auto renew product ID');
  }

  return {
    cycle,
    subscriptionId: data.originalTransactionId,
    createdAt: new Date(data.recentSubscriptionStartDate!),
    expiresAt: new Date(data.renewalDate!),
    provider: SubscriptionProvider.AppleStoreKit,
  };
};

export const handleAppleSubscription = async ({
  transactionInfo,
  renewalInfo,
  user,
  environment,
  notification,
}: {
  transactionInfo: JWSTransactionDecodedPayload;
  renewalInfo: JWSRenewalInfoDecodedPayload;
  user: User;
  environment: Environment;
  notification: ResponseBodyV2DecodedPayload;
}) => {
  // Prevent double subscription
  if (user.subscriptionFlags?.provider === SubscriptionProvider.Paddle) {
    logger.error(
      {
        user,
        environment,
        notification,
        provider: SubscriptionProvider.AppleStoreKit,
      },
      'User already has a Paddle subscription',
    );
    throw new Error('User already has a Paddle subscription');
  }

  const subscriptionStatus = getSubscriptionStatus(
    notification.notificationType,
    notification.subtype,
  );

  const subscriptionFlags = renewalInfoToSubscriptionFlags(renewalInfo);

  await updateStoreKitUserSubscription({
    userId: user.id,
    status: subscriptionStatus,
    data: subscriptionFlags,
  });

  const currencyInUSD = await convertCurrencyToUSD(
    (renewalInfo.renewalPrice || 0) / 1000,
    renewalInfo.currency || 'USD',
  );

  const eventName = getAnalyticsEventFromAppleNotification(
    notification.notificationType,
    notification.subtype,
  );

  if (eventName) {
    await logAppleAnalyticsEvent(
      transactionInfo,
      renewalInfo,
      eventName,
      user,
      currencyInUSD,
    );
  }

  if (notification.notificationType === NotificationTypeV2.SUBSCRIBED) {
    await notifyNewStoreKitSubscription(renewalInfo, user, currencyInUSD);
  }

  if (notification.notificationType === NotificationTypeV2.ONE_TIME_CHARGE) {
    // TODO feat/cores-iap handle one time charge
  }
};
