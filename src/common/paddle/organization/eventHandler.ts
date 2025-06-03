import { EventName, type EventEntity } from '@paddle/paddle-node-sdk';

import { PurchaseType, SubscriptionProvider } from '../../plus';
import { logger } from '../../../logger';
import {
  cancelOrganizationSubscription,
  createOrganizationSubscription,
} from './processing';
import { logPaddleAnalyticsEvent } from '..';
import { AnalyticsEventName } from '../../../integrations/analytics';
import { notifyNewPaddleOrganizationTransaction } from '../slack';

export const processOrganizationPaddleEvent = async (event: EventEntity) => {
  switch (event?.eventType) {
    case EventName.SubscriptionCreated:
      await createOrganizationSubscription({ event });
      break;
    case EventName.SubscriptionUpdated:
      logger.info(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Organization,
          event,
        },
        'Subscription updated',
      );
      break;
    case EventName.SubscriptionCanceled:
      await Promise.all([
        cancelOrganizationSubscription({ event }),
        logPaddleAnalyticsEvent(event, AnalyticsEventName.CancelSubscription),
      ]);
      break;
    case EventName.TransactionCompleted:
      await Promise.all([
        notifyNewPaddleOrganizationTransaction({ event }),
        logPaddleAnalyticsEvent(event, AnalyticsEventName.ReceivePayment),
      ]);
      break;
    default:
      logger.info(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Organization,
        },
        event?.eventType,
      );
  }
};
