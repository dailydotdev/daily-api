import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/deleteUser';
import { Post, Source, User, View } from '../../src/entity';
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
  const now = new Date();
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, View, [
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime()) },
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime() - 1) },
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime() - 2) },
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime() - 3) },
    { postId: 'p1', userId: 'u1', timestamp: new Date(now.getTime() - 4) },
    { postId: 'p2', userId: 'u1', timestamp: new Date(now.getTime() - 5) },
    { postId: 'p2', userId: 'u1', timestamp: new Date(now.getTime() - 6) },
  ]);
});

it('should delete an existing user', async () => {
  await con.getRepository(User).save({
    id: 'u1',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    profileConfirmed: true,
    createdAt: new Date(2021, 7, 11),
  });

  await expectSuccessfulBackground(app, worker, {
    user: {
      id: 'u1',
      name: 'ido',
      image: 'https://daily.dev/image.jpg',
      createdAt: new Date(2021, 7, 11),
    },
  });
  const users = await con.getRepository(User).find();
  expect(users.length).toEqual(0);
  const views = await con.getRepository(View).find();
  expect(views.length).toEqual(0);
});
