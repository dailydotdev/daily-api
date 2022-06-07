import { RedisPubSub } from '@dailydotdev/graphql-redis-subscriptions';
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
  return ioRedisPool.execute(
    (client) =>
      new Promise((resolve, reject) => {
        const stream = client.scanStream({ match: pattern });
        stream.on('data', (keys) => {
          if (keys.length) {
            client.unlink(keys);
          }
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      }),
  );
}

const ioRedisPoolOpts = IORedisPoolOptions.fromHostAndPort(
  redisOptions.host,
  redisOptions.port,
)
  .withIORedisOptions(redisOptions)
  .withPoolOptions({
    min: 10,
    max: 50,
    evictionRunIntervalMillis: 60000,
    idleTimeoutMillis: 30000,
  });

export const ioRedisPool = new IORedisPool(ioRedisPoolOpts);
