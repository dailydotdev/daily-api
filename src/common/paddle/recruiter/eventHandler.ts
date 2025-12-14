import { EventName, type EventEntity } from '@paddle/paddle-node-sdk';
import { PurchaseType, SubscriptionProvider } from '../../plus';
import { logger } from '../../../logger';
import { logPaddleAnalyticsEvent } from '../index';
import { AnalyticsEventName } from '../../../integrations/analytics';
import {
  cancelRecruiterSubscription,
  createOpportunitySubscription,
} from './processing';
import { notifyNewPaddleRecruiterTransaction } from '../slack';

export const processRecruiterPaddleEvent = async (event: EventEntity) => {
  switch (event?.eventType) {
    case EventName.SubscriptionCreated:
      await createOpportunitySubscription({ event });

      break;
    case EventName.SubscriptionCanceled:
      await Promise.all([
        await cancelRecruiterSubscription({ event }),
        logPaddleAnalyticsEvent(event, AnalyticsEventName.CancelSubscription),
      ]);

      break;
    case EventName.SubscriptionUpdated:
      logger.info(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Recruiter,
          event,
        },
        'Subscription updated',
      );

      break;
    case EventName.TransactionCompleted:
      await Promise.all([
        logPaddleAnalyticsEvent(event, AnalyticsEventName.ReceivePayment),
        notifyNewPaddleRecruiterTransaction({ event }),
      ]);

      break;
    default:
      logger.info(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Recruiter,
        },
        event?.eventType,
      );
  }
};
