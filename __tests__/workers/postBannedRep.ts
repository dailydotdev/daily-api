import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import { mocked } from 'ts-jest/utils';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postBannedRep';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { notifyUserReputationUpdated } from '../../src/common';
import { PostReport } from '../../src/entity/PostReport';

jest.mock('../../src/common/pubsub', () => ({
  ...(jest.requireActual('../../src/common/pubsub') as Record<string, unknown>),
  notifyUserReputationUpdated: jest.fn(),
}));

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
    {
      id: '2',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      reputation: 6,
    },
  ]);
  await con.getRepository(PostReport).insert([
    { postId: 'p1', userId: '1', reason: 'BROKEN' },
    { postId: 'p1', userId: '2', reason: 'CLICKBAIT' },
  ]);
});

it('should increase reputation and notify', async () => {
  const post = await con.getRepository(Post).findOne('p1');
  await expectSuccessfulBackground(app, worker, {
    post,
  });
  const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
  expect(users[0].reputation).toEqual(4);
  expect(users[1].reputation).toEqual(7);
  expect(mocked(notifyUserReputationUpdated).mock.calls[0].slice(1)).toEqual([
    '1',
    4,
  ]);
  expect(mocked(notifyUserReputationUpdated).mock.calls[1].slice(1)).toEqual([
    '2',
    7,
  ]);
});
