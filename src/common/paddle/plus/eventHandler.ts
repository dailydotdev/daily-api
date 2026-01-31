import { EventName, type EventEntity } from '@paddle/paddle-node-sdk';
import {
  processPlusTransactionCompleted,
  updateUserSubscription,
} from './processing';
import { PurchaseType, SubscriptionProvider } from '../../plus';
import { logger } from '../../../logger';
import { logPaddleAnalyticsEvent, planChanged } from '../index';
import { AnalyticsEventName } from '../../../integrations/analytics';

export const processPlusPaddleEvent = async (event: EventEntity) => {
  // log all incoming events for monitoring
  logger.info(
    {
      provider: SubscriptionProvider.Paddle,
      purchaseType: PurchaseType.Plus,
      occurredAt: event.occurredAt,
    },
    event.eventType,
  );

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await updateUserSubscription({
        event,
      });

      break;
    case EventName.SubscriptionCanceled:
      await Promise.all([
        updateUserSubscription({
          event,
        }),
        logPaddleAnalyticsEvent(event, AnalyticsEventName.CancelSubscription),
      ]);
      break;
    case EventName.SubscriptionUpdated:
      const didPlanChange = await planChanged(event);
      if (didPlanChange) {
        await updateUserSubscription({
          event,
        });
        await logPaddleAnalyticsEvent(
          event,
          AnalyticsEventName.ChangeBillingCycle,
        );
      }
      break;
    case EventName.TransactionCompleted:
      await Promise.all([
        logPaddleAnalyticsEvent(event, AnalyticsEventName.ReceivePayment),
        processPlusTransactionCompleted({ event }),
      ]);
      break;
    default:
      break;
  }
};
