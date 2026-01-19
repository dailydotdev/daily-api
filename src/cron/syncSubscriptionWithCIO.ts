import { setTimeout } from 'node:timers/promises';
import { syncSubscription } from '../common';
import { StorageKey, StorageTopic, generateStorageKey } from '../config';
import { logger } from '../logger';
import { getRedisListLength, popFromRedisList } from '../redis';
import { Cron } from './cron';
import {
  UserPersonalizedDigest,
  UserPersonalizedDigestType,
} from '../entity/user/UserPersonalizedDigest';
import { User } from '../entity/user/User';

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

        const userRecords = await con
          .createQueryBuilder(User, 'u')
          .leftJoin(
            UserPersonalizedDigest,
            'upd',
            'upd."userId" = u.id AND upd.type = :digestType',
            { digestType: UserPersonalizedDigestType.Digest },
          )
          .where('u.id IN (:...ids)', { ids: Array.from(userIds) })
          .select('u.id AS "userId"')
          .addSelect(
            `
            CASE
              WHEN upd.flags->>'unrested' = 'true' THEN true
              ELSE false
            END AS unrested
            `,
          )
          .getRawMany<{
            userId: string;
            unrested: boolean;
          }>();

        await syncSubscription(
          userRecords
            .filter((item) => !item.unrested)
            .map((item) => item.userId),
          con,
        );

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
