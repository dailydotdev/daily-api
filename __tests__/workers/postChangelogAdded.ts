import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/postChangelogAdded';
import { getRedisObject } from '../../src/redis';
import { REDIS_CHANGELOG_KEY } from '../../src/config';

beforeEach(async () => {
  jest.resetAllMocks();
});

it('should update redis cache', async () => {
  const postDate = '2023-02-06 12:43:21';
  await expectSuccessfulBackground(worker, {
    post: {
      id: 'p1',
      sourceId: 'daily_updates',
      createdAt: postDate,
    },
  });
  expect(await getRedisObject(REDIS_CHANGELOG_KEY)).toEqual(postDate);
});
