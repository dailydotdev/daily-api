import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/clearFeaturesCache';
import {
  deleteKeysByPattern,
  getRedisObject,
  ioRedisPool,
} from '../../src/redis';
import { getFeaturesKey } from '../../src/flagsmith';

beforeEach(async () => {
  jest.resetAllMocks();
  await deleteKeysByPattern(getFeaturesKey('*'));
});

const setCache = (key: string, value: string) =>
  ioRedisPool.execute(async (client) => {
    return client.set(getFeaturesKey(key), value);
  });

// Prevents flaky test because Redis takes time to delete all keys
const waitForDeletion = async (key: string, iteration = 0): Promise<string> => {
  const val = await getRedisObject(key);
  if (val) {
    if (iteration >= 5) {
      return val;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    return waitForDeletion(key, iteration + 1);
  }
  return val;
};

it('should delete flagsmith cache', async () => {
  await setCache('1', 'hello');
  expect(await getRedisObject(getFeaturesKey('1'))).toBeTruthy();
  await expectSuccessfulBackground(worker, {});
  expect(await waitForDeletion(getFeaturesKey('1'))).toBeFalsy();
});
