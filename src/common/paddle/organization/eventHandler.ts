import { EventName, type EventEntity } from '@paddle/paddle-node-sdk';

import { PurchaseType, SubscriptionProvider } from '../../plus';
import { logger } from '../../../logger';
import { createOrganizationSubscription } from './processing';

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
        },
        'Subscription updated',
      );
      break;
    case EventName.SubscriptionCanceled:
      logger.info(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Organization,
        },
        'Subscription canceled',
      );
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
