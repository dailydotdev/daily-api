import { RedisPubSub } from '@dailydotdev/graphql-redis-subscriptions';
import { IORedisPool, IORedisPoolOptions } from '@dailydotdev/ts-ioredis-pool';
import Redis, { RedisKey } from 'ioredis';

export const redisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  password: process.env.REDIS_PASS,
};

export const redisPubSub = new RedisPubSub({
  connection: redisOptions,
});

export const singleRedisClient = new Redis(redisOptions);

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

export const deleteRedisKey = (...keys: string[]): Promise<number> =>
  ioRedisPool.execute((client) => client.unlink(...keys));

export enum RedisMagicValues {
  SLEEPING = 'SLEEPING',
}

type RedisObject = string | Buffer | number;

export const setRedisObject = (key: string, value: RedisObject) =>
  ioRedisPool.execute((client) => client.set(key, value));

export const setRedisObjectWithExpiry = (
  key: string,
  value: RedisObject,
  seconds: number,
) =>
  ioRedisPool.execute((client) =>
    client.set(key, value, 'EX', Math.floor(seconds)),
  );

export const getRedisObject = (key: RedisKey) =>
  ioRedisPool.execute((client) => client.get(key));

export const getRedisKeysByPattern = (pattern: string) =>
  ioRedisPool.execute((client) => client.keys(pattern));

export const getRedisObjectExpiry = (key: string) =>
  ioRedisPool.execute((client) => client.ttl(key));

export const getRedisObjectExpiryTime = (key: string) =>
  ioRedisPool.execute((client) => client.expiretime(key));

export const pushToRedisList = (
  key: string,
  value: RedisObject,
  position: 'start' | 'end' = 'end', // Defaults to end
) =>
  ioRedisPool.execute((client) =>
    position === 'start' ? client.lpush(key, value) : client.rpush(key, value),
  );

export const popFromRedisList = (
  key: string,
  count: number = 1,
  position: 'start' | 'end' = 'start', // Defaults to start
) =>
  ioRedisPool.execute((client) =>
    position === 'start' ? client.lpop(key, count) : client.rpop(key, count),
  );

export const getRedisListLength = (key: string) =>
  ioRedisPool.execute((client) => client.llen(key));

export const setRedisHashWithExpiry = (
  key: string,
  value: object,
  seconds: number,
) =>
  ioRedisPool.execute((client) =>
    client.multi().hset(key, value).expire(key, seconds).exec(),
  );

export const getRedisHash = (key: string) =>
  ioRedisPool.execute((client) => client.hgetall(key));

export const getRedisHashField = (key: string, field: string) =>
  ioRedisPool.execute((client) => client.hget(key, field));

export const checkRedisObjectExists = (key: string) =>
  ioRedisPool.execute((client) => client.exists(key));

export const setRedisHash = <T extends object>(key: string, value: T) =>
  ioRedisPool.execute((client) => client.hset(key, value));
