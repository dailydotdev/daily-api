import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/bannerAdded';
import { getRedisObject } from '../../src/redis';
import { REDIS_BANNER_KEY } from '../../src/config';

beforeEach(async () => {
  jest.resetAllMocks();
});

it('should update redis cache', async () => {
  const postDateTs = Date.now();

  await expectSuccessfulBackground(worker, {
    banner: {
      timestamp: postDateTs * 1000, // createdAt comes as μs from messageToJson,
      title: 'test',
      subtitle: 'test',
      cta: 'test',
      url: 'test',
      theme: 'cabbage',
    },
  });
  expect(await getRedisObject(REDIS_BANNER_KEY)).toEqual(
    new Date(postDateTs).toISOString(),
  );
});
