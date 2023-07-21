import { messageToJson, Worker } from './worker';
import { ioRedisPool } from '../redis';

interface Data {
  user_id: string;
  experiment_id: string;
  variation_id: string;
  server_timestamp: Date;
}

const parseHash = (
  hash: Record<string, string>,
): Record<string, { variation: string; timestamp: Date }> => {
  return Object.keys(hash).reduce((acc, key) => {
    const [variation, timestamp] = hash[key].split(':');
    acc[key] = {
      variation,
      timestamp: new Date(parseInt(timestamp)),
    };
    return acc;
  }, {});
};

const keysToDrop = (
  exp: Record<string, { variation: string; timestamp: Date }>,
  maxItems = 10,
): string[] => {
  return Object.keys(exp)
    .sort((a, b) => exp[b].timestamp.getTime() - exp[a].timestamp.getTime())
    .slice(maxItems);
};

const worker: Worker = {
  subscription: 'api.experiment-allocated',
  handler: async (message): Promise<void> => {
    const data: Data = messageToJson(message);
    await ioRedisPool.execute(async (client) => {
      const key = `exp:${data.user_id}`;
      const exps = parseHash(await client.hgetall(key));
      const current = {
        variation: data.variation_id,
        timestamp: new Date(data.server_timestamp),
      };
      exps[data.experiment_id] = current;
      const drop = keysToDrop(exps);
      client.hdel(key, ...drop);
      client.hset(
        key,
        data.experiment_id,
        `${current.variation}:${current.timestamp.getTime()}`,
      );
      client.expire(key, 60 * 60 * 24 * 30);
    });
  },
};

export default worker;
