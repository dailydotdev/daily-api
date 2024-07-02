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

    while ((await getRedisListLength(redisKey)) > 0) {
      // Store it in a set to remove duplicates
      const userIds = new Set(await popFromRedisList(redisKey, 100));

      await syncSubscription([...userIds], con);

      logger.info(`synced subscriptions for ${userIds.size} users`);
    }
  },
};

export default cron;
