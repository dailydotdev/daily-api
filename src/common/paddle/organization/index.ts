import { createHmac } from 'node:crypto';
import { paddleInstance } from '..';
import { generateStorageKey, StorageKey, StorageTopic } from '../../../config';
import {
  deleteRedisKey,
  getRedisObject,
  setRedisObjectWithExpiry,
} from '../../../redis';
import type { SubscriptionPreview } from '@paddle/paddle-node-sdk';
import { ONE_HOUR_IN_SECONDS } from '../../constants';
import { z } from 'zod';

export type FetchSubscriptionUpdatePreview = {
  subscriptionId: string;
  priceId: string;
  quantity: number;
};

export const subscriptionUpdateSchema = z.object({
  id: z.string({
    error: 'Subscription ID is required',
  }),
  locale: z.string().trim().optional(),
  quantity: z.int().positive({
    error: 'Quantity must be a positive integer',
  }),
});

const generateKey = ({
  subscriptionId,
  priceId,
  quantity,
}: FetchSubscriptionUpdatePreview) => {
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

  return redisKey;
};

export const fetchSubscriptionUpdatePreview = async (
  params: FetchSubscriptionUpdatePreview,
): Promise<SubscriptionPreview> => {
  const { subscriptionId, priceId, quantity } = params;

  const redisKey = generateKey(params);

  const redisResult = await getRedisObject(redisKey);

  if (redisResult) {
    return JSON.parse(redisResult) as SubscriptionPreview;
  }

  const previewResult = await paddleInstance.subscriptions.previewUpdate(
    subscriptionId,
    {
      prorationBillingMode: 'prorated_immediately',
      items: [
        {
          priceId,
          quantity,
        },
      ],
    },
  );

  await setRedisObjectWithExpiry(
    redisKey,
    JSON.stringify(previewResult),
    ONE_HOUR_IN_SECONDS,
  );

  return previewResult;
};

export const updateOrganizationSubscription = async (
  params: FetchSubscriptionUpdatePreview,
) => {
  const { subscriptionId, priceId, quantity } = params;

  const redisKey = generateKey(params);

  const updateResult = await paddleInstance.subscriptions.update(
    subscriptionId,
    {
      prorationBillingMode: 'prorated_immediately',
      items: [
        {
          priceId,
          quantity,
        },
      ],
    },
  );

  await deleteRedisKey(redisKey);

  return updateResult;
};
