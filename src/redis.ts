import { RedisPubSub } from 'graphql-redis-subscriptions';
import { IORedisPool, IORedisPoolOptions } from '@dailydotdev/ts-ioredis-pool';

export const redisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  password: process.env.REDIS_PASS,
};

export const redisPubSub = new RedisPubSub({
  connection: redisOptions,
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
