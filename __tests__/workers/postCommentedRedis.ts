import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postCommentedRedis';
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

it('should publish an event to redis', async (done) => {
  const subId = await redisPubSub.subscribe(
    'events.posts.commented',
    (value) => {
      expect(value).toEqual({
        postId: 'p1',
        userId: '1',
        commentId: 'c1',
      });
      redisPubSub.unsubscribe(subId);
      done();
    },
  );
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: '1',
    commentId: 'c1',
  });
});
