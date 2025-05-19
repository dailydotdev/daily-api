import { EventName, type EventEntity } from '@paddle/paddle-node-sdk';

import { SubscriptionProvider } from '../../plus';
import { logger } from '../../../logger';

export const processOrganizationPaddleEvent = async (event: EventEntity) => {
  switch (event?.eventType) {
    case EventName.SubscriptionCreated:
      console.log('Organization subscription created');
      console.log(JSON.stringify(event, null, 2));
      break;
    default:
      logger.info({ provider: SubscriptionProvider.Paddle }, event?.eventType);
  }
};
