import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';

import appFunc from '../../src/background';
import worker from '../../src/workers/newView';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { postsFixture } from '../fixture/post';
import { Post, Source, SourceDisplay, View } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { sourceDisplaysFixture } from '../fixture/sourceDisplay';

let con: Connection;
let app: FastifyInstance;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
});

it('should save a new view without timestamp', async () => {
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
  });
  const views = await con.getRepository(View).find();
  expect(views.length).toEqual(1);
  expect(views[0]).toMatchSnapshot({
    timestamp: expect.any(Date),
  });
});

it('should save a new view with the provided timestamp', async () => {
  const timestamp = new Date(2020, 5, 11, 1, 17);
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
    timestamp: timestamp.toISOString(),
  });
  const views = await con.getRepository(View).find();
  expect(views.length).toEqual(1);
  expect(views[0]).toMatchSnapshot();
});

it('should not save a new view within a week since the last view', async () => {
  const data = {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
    timestamp: new Date(2020, 5, 11, 1, 17).toISOString(),
  };
  await expectSuccessfulBackground(app, worker, data);
  await expectSuccessfulBackground(app, worker, {
    ...data,
    timestamp: new Date(2020, 5, 13, 1, 17).toISOString(),
  });
  const views = await con.getRepository(View).find();
  expect(views.length).toEqual(1);
  expect(views[0]).toMatchSnapshot();
});

it('should save a new view after a week since the last view', async () => {
  const data = {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
    timestamp: new Date(2020, 5, 11, 1, 17).toISOString(),
  };
  await expectSuccessfulBackground(app, worker, data);
  await expectSuccessfulBackground(app, worker, {
    ...data,
    timestamp: new Date(2020, 5, 19, 1, 17).toISOString(),
  });

  const views = await con.getRepository(View).find();

  expect(views.length).toEqual(2);
  expect(views[1]).toMatchSnapshot();
});
