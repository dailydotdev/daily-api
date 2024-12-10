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
export const cancelSubscription = async ({
  subscriptionId,
}: CancelSubscriptionProps): Promise<Subscription | undefined> => {
  try {
    return await paddleInstance.subscriptions.cancel(subscriptionId, {
      effectiveFrom: null,
    });
  } catch (e) {
    logger.error(
      {
        type: 'paddle',
        subscriptionId,
        error: e.message,
      },
      'Subscription cancellation failed',
    );
  }
};
