import { EventName, type EventEntity } from '@paddle/paddle-node-sdk';
import {
  processTransactionCompleted,
  processTransactionCreated,
  processTransactionPaid,
  processTransactionPaymentFailed,
  processTransactionUpdated,
} from './processing';
import { SubscriptionProvider } from '../../../../entity/user/User';
import { logger } from '../../../../logger';
import { logPaddleAnalyticsEvent } from '../../../../common/paddle';
import { AnalyticsEventName } from '../../../../integrations/analytics';

export const processCorePaddleEvent = async (event: EventEntity) => {
  switch (event?.eventType) {
    case EventName.TransactionCreated:
      await processTransactionCreated({
        event,
      });

      break;
    case EventName.TransactionPaid:
      await processTransactionPaid({
        event,
      });

      break;
    case EventName.TransactionPaymentFailed:
      await processTransactionPaymentFailed({
        event,
      });

      break;
    case EventName.TransactionUpdated:
      await processTransactionUpdated({
        event,
      });

      break;
    case EventName.TransactionCompleted:
      await Promise.all([
        logPaddleAnalyticsEvent(event, AnalyticsEventName.ReceivePayment),
        processTransactionCompleted({ event }),
      ]);
      break;
    default:
      logger.info({ provider: SubscriptionProvider.Paddle }, event?.eventType);
  }
};
