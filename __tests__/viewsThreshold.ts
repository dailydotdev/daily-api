import { Connection, getConnection } from 'typeorm';

import cron from '../src/cron/viewsThreshold';
import { saveFixtures } from './helpers';
import { Post, Source } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture } from './fixture/post';
import { notifyPostReachedViewsThreshold } from '../src/common';
import { mocked } from 'ts-jest/utils';

let con: Connection;

jest.mock('../src/common', () => ({
  ...jest.requireActual('../src/common'),
  notifyPostReachedViewsThreshold: jest.fn(),
}));

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
});

it('should not update anything', async () => {
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { views: 300, viewsThreshold: 1 });
  await con
    .getRepository(Post)
    .update({ id: 'p2' }, { views: 600, viewsThreshold: 2 });
  await cron.handler(con);
  const posts = await con.getRepository(Post).find({
    select: ['id', 'viewsThreshold'],
    order: { id: 'ASC' },
  });
  expect(posts).toMatchSnapshot();
  expect(notifyPostReachedViewsThreshold).toBeCalledTimes(0);
});

it('should update 3 posts that reached views threshold', async () => {
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { views: 300, viewsThreshold: 0 });
  await con
    .getRepository(Post)
    .update({ id: 'p2' }, { views: 600, viewsThreshold: 0 });
  await con
    .getRepository(Post)
    .update({ id: 'p3' }, { views: 600, viewsThreshold: 1 });
  await cron.handler(con);
  const posts = await con.getRepository(Post).find({
    select: ['id', 'viewsThreshold'],
    order: { id: 'ASC' },
  });
  expect(posts).toMatchSnapshot();
  expect(
    mocked(notifyPostReachedViewsThreshold).mock.calls.map((call) =>
      call.slice(1),
    ),
  ).toMatchSnapshot();
});
