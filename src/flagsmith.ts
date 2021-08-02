import flagsmith from 'flagsmith-nodejs';
import { redisClient } from './redis';

const getKey = (key: string): string => `flagsmith:${key}`;

flagsmith.init({
  environmentID: process.env.FLAGSMITH_KEY,
  cache: {
    has: async (key) => {
      const reply = await redisClient.exists(getKey(key));
      return reply === 1;
    },
    get: async (key) => {
      const cacheValue = await redisClient.get(getKey(key));
      return cacheValue && JSON.parse(cacheValue);
    },
    set: async (key, value) => {
      await redisClient.set(getKey(key), JSON.stringify(value), 'ex', 60 * 60);
    },
  },
});

export default flagsmith;
