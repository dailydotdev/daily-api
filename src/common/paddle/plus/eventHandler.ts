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
  switch (event?.eventType) {
    case EventName.SubscriptionCreated:
      await updateUserSubscription({
        event,
        state: true,
      });

      break;
    case EventName.SubscriptionCanceled:
      await Promise.all([
        updateUserSubscription({
          event,
          state: false,
        }),
        logPaddleAnalyticsEvent(event, AnalyticsEventName.CancelSubscription),
      ]);
      break;
    case EventName.SubscriptionUpdated:
      const didPlanChange = await planChanged(event);
      if (didPlanChange) {
        await updateUserSubscription({
          event,
          state: true,
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
      logger.info(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Plus,
        },
        event?.eventType,
      );
  }
};
