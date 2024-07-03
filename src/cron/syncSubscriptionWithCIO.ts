import { setTimeout } from 'node:timers/promises';
import { syncSubscription } from '../common';
import { StorageKey, StorageTopic, generateStorageKey } from '../config';
import { logger } from '../logger';
import { getRedisListLength, popFromRedisList } from '../redis';
import { Cron } from './cron';

const redisKey = generateStorageKey(
  StorageTopic.CIO,
  StorageKey.Reporting,
  'global',
);

const cron: Cron = {
  name: 'sync-subscription-with-cio',
  handler: async (con) => {
    logger.info('syncing subscriptions with customer.io');

    let iterations = 0;
    let syncedSubscriptions = 0;

    while ((await getRedisListLength(redisKey)) > 0) {
      try {
        const userIdsRaw = await popFromRedisList(redisKey, 100);
        if (!userIdsRaw) {
          break;
        }
        // Store it in a set to remove duplicates
        const userIds = new Set(userIdsRaw);

        await syncSubscription([...userIds], con);

        // Wait for a bit to avoid rate limiting
        await setTimeout(200);

        syncedSubscriptions += userIds.size;
        logger.debug({ count: userIds.size }, `synced subscriptions`);
      } catch (err) {
        logger.error({ err }, 'error syncing subscriptions');
        break;
      }

      iterations += 1;
      if (iterations > 100) {
        logger.error('Too many iterations');
        break;
      }
    }
    logger.info({ count: syncedSubscriptions }, 'synced subscriptions');
  },
};

export default cron;
