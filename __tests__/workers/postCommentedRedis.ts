import { Connection, getConnection } from 'typeorm';

import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postCommentedRedis';
import { Post, Source } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { redisPubSub } from '../../src/redis';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
});

it('should publish an event to redis', async () => {
  return new Promise<void>(async (resolve) => {
    const subId = await redisPubSub.subscribe(
      'events.posts.commented',
      (value) => {
        expect(value).toEqual({
          postId: 'p1',
          userId: '1',
          commentId: 'c1',
        });
        redisPubSub.unsubscribe(subId);
        resolve();
      },
    );
    await expectSuccessfulBackground(worker, {
      postId: 'p1',
      userId: '1',
      commentId: 'c1',
    });
  });
});
