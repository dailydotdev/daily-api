import {
  type Environment,
  LogLevel,
  Paddle,
  type Subscription,
} from '@paddle/paddle-node-sdk';
import { logger } from '../logger';
import { PricingPreviewLineItem } from '@paddle/paddle-node-sdk/dist/types/entities/pricing-preview';
import { SubscriptionProvider } from '../entity';
import { isProd } from './utils';

export const paddleInstance = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENVIRONMENT as Environment,
  logLevel: isProd ? LogLevel.error : LogLevel.verbose,
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
        provider: SubscriptionProvider.Paddle,
        subscriptionId,
        error: e,
      },
      'Subscription cancellation failed',
    );
    throw e;
  }
};

export const removeNonNumber = (value: string): string =>
  value.replace(/,(\d{2})$/, '.$1').replace(/[^\d.]/g, '');

export const getPriceFromPaddleItem = (
  item: PricingPreviewLineItem,
): number => {
  const priceAmount = parseFloat(item.totals.total);
  const priceAmountFormatted = parseFloat(
    removeNonNumber(item.formattedTotals.total),
  );

  if (priceAmount === priceAmountFormatted) {
    return priceAmount;
  }

  return priceAmount / 100;
};
