import { RedisCounter } from '../../src/common/redis/redisCounters';
import { getRedisObjectExpiry, ioRedisPool } from '../../src/redis';
import { StorageTopic, generateStorageKey } from '../../src/config';

describe('RedisCounter', () => {
  const userId = 'test-user';
  const keyPrefix = 'test-redis-counter';
  const counter = new RedisCounter(keyPrefix);

  // Helper to get the current redis key
  const getCurrentKey = () =>
    generateStorageKey(StorageTopic.RedisCounter, keyPrefix, userId);

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
  });

  it('should start at 0', async () => {
    const value = await counter.get(userId);
    expect(value).toBe(0);
  });

  it('should increment and get the correct value', async () => {
    await counter.increment({ userId, expiration: 60 });
    let value = await counter.get(userId);
    expect(value).toBe(1);
    await counter.increment({ userId, expiration: 2, amount: 2 });
    value = await counter.get(userId);
    expect(value).toBe(3);
  });

  it('should reset the counter', async () => {
    await counter.increment({ userId, expiration: 5, amount: 5 });
    let value = await counter.get(userId);
    expect(value).toBe(5);
    await counter.reset(userId);
    value = await counter.get(userId);
    expect(value).toBe(0);
  });

  it('should set expiry', async () => {
    await counter.increment({ userId, expiration: 60 });
    const key = getCurrentKey();
    const ttl = await getRedisObjectExpiry(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it('should not overwrite an existing counter or expiry when incrementing again', async () => {
    await counter.increment({ userId, expiration: 2, amount: 2 });
    const key = getCurrentKey();
    const ttl1 = await getRedisObjectExpiry(key);
    await counter.increment({ userId, expiration: 3, amount: 3 });
    const value = await counter.get(userId);
    expect(value).toBe(5);
    const ttl2 = await getRedisObjectExpiry(key);
    expect(ttl2).toBeLessThanOrEqual(ttl1);
  });
});
