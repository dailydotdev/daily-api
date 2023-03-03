import worker from '../../src/workers/newView';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { postsFixture } from '../fixture/post';
import { ArticlePost, Source, View } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

it('should save a new view without timestamp', async () => {
  await expectSuccessfulBackground(worker, {
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
  await expectSuccessfulBackground(worker, {
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
  await expectSuccessfulBackground(worker, data);
  await expectSuccessfulBackground(worker, {
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
  await expectSuccessfulBackground(worker, data);
  await expectSuccessfulBackground(worker, {
    ...data,
    timestamp: new Date(2020, 5, 19, 1, 17).toISOString(),
  });

  const views = await con.getRepository(View).find();

  expect(views.length).toEqual(2);
  expect(views[1]).toMatchSnapshot();
});
