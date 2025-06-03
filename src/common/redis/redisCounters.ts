import { StorageTopic, generateStorageKey } from '../../config';
import {
  checkRedisObjectExists,
  getRedisObject,
  deleteRedisKey,
  setRedisObjectWithExpiry,
  ioRedisPool,
} from '../../redis';

export class RedisCounter {
  keyPrefix: string;

  constructor(keyPrefix: string) {
    this.keyPrefix = keyPrefix;
  }

  getCounterKey(userId: string): string {
    return generateStorageKey(
      StorageTopic.RedisCounter,
      this.keyPrefix,
      userId,
    );
  }

  async increment(opts: {
    userId: string;
    expiration?: number;
    amount?: number;
  }): Promise<number> {
    const { userId, expiration, amount = 1 } = opts;
    const key = this.getCounterKey(userId);
    if (typeof expiration !== 'number') {
      throw new Error('Expiration must be provided to increment()');
    }
    const exists = await checkRedisObjectExists(key);
    if (!exists) {
      await setRedisObjectWithExpiry(key, amount, expiration);
      return amount;
    } else {
      // Use pool directly for atomic increment
      return ioRedisPool.execute((client) => client.incrby(key, amount));
    }
  }

  async get(userId: string): Promise<number> {
    const key = this.getCounterKey(userId);
    const value = await getRedisObject(key);
    return value ? parseInt(value, 10) : 0;
  }

  async reset(userId: string): Promise<void> {
    const key = this.getCounterKey(userId);
    await deleteRedisKey(key);
  }
}

// Example usage for a paid function trial counter:
// import { RedisCounter } from './common/redisCounters';
// const trialCounter = new RedisCounter('trial');
// await trialCounter.increment({ userId, expiration: 2592000 }); // 30 days in seconds
// const used = await trialCounter.get(userId);
