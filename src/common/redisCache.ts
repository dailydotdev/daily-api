import { DataSource, IsNull } from 'typeorm';
import { StorageKey, StorageTopic, generateStorageKey } from '../config';
import { MarketingCtaStatus, UserMarketingCta } from '../entity';
import { RedisMagicValues, setRedisObjectWithExpiry } from '../redis';
import { ONE_WEEK_IN_SECONDS } from './index';

export const cachePrefillMarketingCta = async (
  con: DataSource,
  userId: string,
) => {
  const redisKey = generateStorageKey(
    StorageTopic.Boot,
    StorageKey.MarketingCta,
    userId,
  );

  const userMarketingCta = await con.getRepository(UserMarketingCta).findOne({
    where: {
      userId,
      readAt: IsNull(),
      marketingCta: {
        status: MarketingCtaStatus.Active,
      },
    },
    order: { createdAt: 'ASC' },
    relations: ['marketingCta'],
  });

  const marketingCta = userMarketingCta?.marketingCta || null;
  const redisValue = userMarketingCta
    ? JSON.stringify(marketingCta)
    : RedisMagicValues.SLEEPING;

  setRedisObjectWithExpiry(redisKey, redisValue, ONE_WEEK_IN_SECONDS);

  return marketingCta;
};
