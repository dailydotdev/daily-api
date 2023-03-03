import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/postChangelogAdded';
import { getRedisObject } from '../../src/redis';
import { REDIS_CHANGELOG_KEY } from '../../src/config';

beforeEach(async () => {
  jest.resetAllMocks();
});

it('should update redis cache', async () => {
  const postDateTs = Date.now();

  await expectSuccessfulBackground(worker, {
    post: {
      id: 'p1',
      sourceId: 'daily_updates',
      createdAt: postDateTs * 1000, // createdAt comes as μs from messageToJson
    },
  });
  expect(await getRedisObject(REDIS_CHANGELOG_KEY)).toEqual(
    new Date(postDateTs).toISOString(),
  );
});
