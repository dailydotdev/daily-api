import { createHmac } from 'node:crypto';
import { paddleInstance } from '..';
import { generateStorageKey, StorageKey, StorageTopic } from '../../../config';
import { getRedisObject, setRedisObjectWithExpiry } from '../../../redis';
import type { SubscriptionPreview } from '@paddle/paddle-node-sdk';
import { ONE_HOUR_IN_SECONDS } from '../../constants';
import { z } from 'zod';

export type FetchSubscriptionUpdatePreview = {
  subscriptionId: string;
  priceId: string;
  quantity: number;
};

export const previewSubscriptionUpdateSchema = z.object({
  id: z.string({ message: 'Subscription ID is required' }),
  locale: z.string().trim().optional(),
  quantity: z
    .number()
    .int()
    .positive({ message: 'Quantity must be a positive integer' }),
});

export const fetchSubscriptionUpdatePreview = async ({
  subscriptionId,
  priceId,
  quantity,
}: FetchSubscriptionUpdatePreview): Promise<SubscriptionPreview> => {
  const hmac = createHmac('sha1', StorageTopic.Paddle);
  hmac.update(subscriptionId);
  hmac.update(priceId);
  hmac.update(quantity.toString());
  const pricesHash = hmac.digest().toString('hex');

  const redisKey = generateStorageKey(
    StorageTopic.Paddle,
    StorageKey.OrganizationSubscriptionUpdatePreview,
    pricesHash,
  );

  const redisResult = await getRedisObject(redisKey);

  if (redisResult) {
    return JSON.parse(redisResult) as SubscriptionPreview;
  }

  const preview = await paddleInstance.subscriptions.previewUpdate(
    subscriptionId,
    {
      items: [
        {
          priceId,
          quantity,
        },
      ],
      prorationBillingMode: 'prorated_immediately',
    },
  );

  await setRedisObjectWithExpiry(
    redisKey,
    JSON.stringify(preview),
    ONE_HOUR_IN_SECONDS,
  );

  return preview;
};
