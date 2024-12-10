import {
  type Environment,
  Paddle,
  type Subscription,
} from '@paddle/paddle-node-sdk';
import { logger } from '../logger';

export const paddleInstance = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENVIRONMENT as Environment,
});

type CancelSubscriptionProps = {
  subscriptionId: string;
};
export const cancelSubscription = ({
  subscriptionId,
}: CancelSubscriptionProps): Promise<Subscription> => {
  logger.info(
    {
      type: 'paddle',
      subscriptionId,
    },
    'Subscription cancelled user deletion',
  );
  try {
    return paddleInstance.subscriptions.cancel(subscriptionId, {
      effectiveFrom: null,
    });
  } catch (e) {
    logger.error(
      {
        type: 'paddle',
        subscriptionId,
      },
      'Subscription cancellation failed',
    );
  }
};
