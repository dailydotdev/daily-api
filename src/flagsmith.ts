import Flagsmith from 'flagsmith-nodejs';
import { Flag } from 'flagsmith-nodejs/sdk/models';
import { ioRedisPool } from './redis';

export type IFlags = { [key: string]: Pick<Flag, 'enabled' | 'value'> };

export const getFeaturesKey = (key: string): string => `flagsmith:${key}`;

const flagsmith = new Flagsmith({
  apiUrl: 'https://edge.api.flagsmith.com/api/v1/',
  environmentKey: process.env.FLAGSMITH_KEY,
  cache: {
    has: async (key) => {
      const reply = await ioRedisPool.execute((client) =>
        client.exists(getFeaturesKey(key)),
      );
      return reply === 1;
    },
    get: async (key) => {
      const cacheValue = await ioRedisPool.execute((client) =>
        client.get(getFeaturesKey(key)),
      );
      const parsed = cacheValue && JSON.parse(cacheValue);
      if (parsed && !parsed.flags) {
        return { flags: parsed };
      }
      return parsed;
    },
    set: async (key, value) => {
      await ioRedisPool.execute((client) =>
        client.set(
          getFeaturesKey(key),
          JSON.stringify(value),
          'EX',
          60 * 60 * 24 * 30,
        ),
      );
      return false;
    },
  },
});

export default flagsmith;
