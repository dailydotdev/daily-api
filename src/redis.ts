import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis, { RedisOptions } from 'ioredis';

export const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  password: process.env.REDIS_PASS,
};

export const redisClient: Redis.Redis = new Redis(redisOptions);

export const redisPubSub = new RedisPubSub({
  publisher: new Redis(redisOptions),
  subscriber: new Redis(redisOptions),
});

export function deleteKeysByPattern(pattern: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = redisClient.scanStream({ match: pattern });
    stream.on('data', (keys) => {
      if (keys.length) {
        redisClient.unlink(keys);
      } else {
        stream.destroy();
        resolve();
      }
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}
