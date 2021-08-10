import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpvotedRep';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';

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
  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      reputation: 3,
    },
  ]);
  await con.getRepository(Post).update('p1', { authorId: '1' });
});

it('should increase reputation and notify', async () => {
  await expectSuccessfulBackground(app, worker, {
    userId: '2',
    postId: 'p1',
  });
  const user = await con.getRepository(User).findOne('1');
  expect(user.reputation).toEqual(4);
});

it('should not increase reputation when the author is the upvote user', async () => {
  await expectSuccessfulBackground(app, worker, {
    userId: '1',
    postId: 'p1',
  });
  const user = await con.getRepository(User).findOne('1');
  expect(user.reputation).toEqual(3);
});
