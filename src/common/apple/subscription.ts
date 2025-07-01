import {
  NotificationTypeV2,
  Subtype,
  type Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import { logger } from '../../logger';
import { type User, type UserSubscriptionFlags } from '../../entity/user/User';
import { convertCurrencyToUSD } from '../../integrations/openExchangeRates';
import { updateStoreKitUserSubscription } from '../../plusSubscription';
import { isNullOrUndefined } from '../object';
import {
  getAnalyticsEventFromAppleNotification,
  logAppleAnalyticsEvent,
} from './utils';
import { productIdToCycle } from './types';
import { concatTextToNewline, isTest } from '../utils';
import type { Block, KnownBlock } from '@slack/web-api';
import { webhooks } from '../slack';
import {
  PurchaseType,
  SubscriptionProvider,
  SubscriptionStatus,
} from '../plus';

const getSubscriptionStatus = (
  notificationType: ResponseBodyV2DecodedPayload['notificationType'],
  subtype?: ResponseBodyV2DecodedPayload['subtype'],
): SubscriptionStatus | undefined => {
  switch (notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF: // Upgrade/Downgrade
    case NotificationTypeV2.REFUND_REVERSED:
      return SubscriptionStatus.Active;
    case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS: // Disable/Enable Auto-Renew
      return subtype === Subtype.AUTO_RENEW_ENABLED
        ? SubscriptionStatus.Active
        : SubscriptionStatus.Cancelled;
    case NotificationTypeV2.DID_FAIL_TO_RENEW:
      // When user fails to renew and there is no grace period
      if (isNullOrUndefined(subtype)) {
        return SubscriptionStatus.Cancelled;
      }
    case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
      return SubscriptionStatus.Cancelled;
    case NotificationTypeV2.REFUND:
    case NotificationTypeV2.EXPIRED:
    case NotificationTypeV2.REVOKE: // We don't support Family Sharing, but to be on the safe side
      return SubscriptionStatus.Expired;
    case NotificationTypeV2.CONSUMPTION_REQUEST:
      return undefined;
    default:
      logger.error(
        {
          notificationType,
          subtype,
          provider: SubscriptionProvider.AppleStoreKit,
          purchaseType: PurchaseType.Plus,
        },
        'Unknown notification type',
      );
      throw new Error('Unknown notification type');
  }
};

export const notifyNewStoreKitSubscription = async (
  data: JWSRenewalInfoDecodedPayload,
  user: Pick<User, 'id' | 'subscriptionFlags' | 'coresRole'>,
  currencyInUSD: number,
) => {
  if (isTest) {
    return;
  }

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'New Plus subscriber :moneybag: :apple-ico:',
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
            data.originalTransactionId,
          ),
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
          text: concatTextToNewline('*Type:*', data.autoRenewProductId),
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
            }).format((data.renewalPrice || 0) / 1000),
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

const renewalInfoToSubscriptionFlags = (
  data: JWSRenewalInfoDecodedPayload,
): UserSubscriptionFlags => {
  const cycle =
    productIdToCycle[data.autoRenewProductId as keyof typeof productIdToCycle];

  if (isNullOrUndefined(cycle)) {
    logger.error(
      {
        data,
        provider: SubscriptionProvider.AppleStoreKit,
        purchaseType: PurchaseType.Plus,
      },
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
  user: Pick<User, 'id' | 'subscriptionFlags' | 'coresRole'>;
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
        purchaseType: PurchaseType.Plus,
      },
      'User already has a Paddle subscription',
    );
    throw new Error('User already has a Paddle subscription');
  }

  const subscriptionStatus = getSubscriptionStatus(
    notification.notificationType,
    notification.subtype,
  );

  if (typeof subscriptionStatus === 'undefined') {
    // we don't handle some notification types so then we skip updating the subscription
    // until notification type we support arrives

    return;
  }

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
};
