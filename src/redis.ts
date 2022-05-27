import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis, { RedisOptions } from 'ioredis';
import { IORedisPool, IORedisPoolOptions } from 'ts-ioredis-pool';

export const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  password: process.env.REDIS_PASS,
};

// export const redisClient: Redis.Redis = new Redis(redisOptions);

export const redisPubSub = new RedisPubSub({
  publisher: new Redis(redisOptions),
  subscriber: new Redis(redisOptions),
});

export function deleteKeysByPattern(pattern: string): Promise<void> {
  return new Promise((resolve, reject) => {
    return ioRedisPool.execute(async (client) => {
      const stream = client.scanStream({ match: pattern });
      stream.on('data', (keys) => {
        if (keys.length) {
          client.unlink(keys);
        } else {
          stream.destroy();
          resolve();
        }
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  });
}

const ioRedisPoolOpts = IORedisPoolOptions.fromUrl(
  process.env.REDIS_URL as string,
)
  .withIORedisOptions(redisOptions)
  .withPoolOptions({
    min: 10,
    max: 50,
    evictionRunIntervalMillis: 60000,
    idleTimeoutMillis: 30000,
  });

export const ioRedisPool = new IORedisPool(ioRedisPoolOpts);
