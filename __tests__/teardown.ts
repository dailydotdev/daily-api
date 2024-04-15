import '../src/config';
import createOrGetConnection from '../src/db';
import { ioRedisPool, redisPubSub, singleRedisClient } from '../src/redis';

async function teardown() {
  const con = await createOrGetConnection();
  await con.destroy();
  singleRedisClient.disconnect();
  redisPubSub.getPublisher().disconnect();
  redisPubSub.getSubscriber().disconnect();
  await redisPubSub.close();
  await ioRedisPool.end();
}

module.exports = teardown;
