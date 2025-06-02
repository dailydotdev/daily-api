import {
  hasTriesLeft,
  tryIncrement,
} from '../../src/common/redis/clickbaitShieldCounter';
import { ioRedisPool } from '../../src/redis';

describe('clickbaitShieldCounter', () => {
  const userId = 'test-clickbait-user';

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
  });

  it('should allow up to 5 tries per month', async () => {
    for (let i = 0; i < 5; i++) {
      const hasTries = await hasTriesLeft(userId);
      expect(hasTries).toBe(true);
      const incremented = await tryIncrement(userId);
      expect(incremented).toBe(true);
    }
    // After 5 tries, should not allow more
    const hasTries = await hasTriesLeft(userId);
    expect(hasTries).toBe(false);
    const incremented = await tryIncrement(userId);
    expect(incremented).toBe(false);
  });

  it('should not increment if no tries left', async () => {
    // Use up all tries
    for (let i = 0; i < 5; i++) {
      await tryIncrement(userId);
    }
    // 6th try should not increment
    const result = await tryIncrement(userId);
    expect(result).toBe(false);
  });
});
