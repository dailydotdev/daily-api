import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postCommentedRedis';
import { ArticlePost, Source } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { redisPubSub } from '../../src/redis';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

it('should publish an event to redis', async () => {
  return new Promise<void>(async (resolve) => {
    const subId = await redisPubSub.subscribe(
      'events.posts.commented',
      (value) => {
        expect(value).toEqual({
          id: 'p1',
          numComments: 0,
          numUpvotes: 0,
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
