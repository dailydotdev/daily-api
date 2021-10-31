import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpvotedRedis';
import { Post, Source } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { redisPubSub } from '../../src/redis';

let con: Connection;
let app: FastifyInstance;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
});

it('should publish an event to redis', async () => {
  return new Promise<void>(async (resolve) => {
    const subId = await redisPubSub.subscribe(
      'events.posts.upvoted',
      (value) => {
        expect(value).toEqual({
          userId: '2',
          postId: 'p1',
        });
        redisPubSub.unsubscribe(subId);
        resolve();
      },
    );
    await expectSuccessfulBackground(app, worker, {
      userId: '2',
      postId: 'p1',
    });
  });
});
