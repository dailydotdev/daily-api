import { startOfYesterday, startOfToday, add, sub } from 'date-fns';
import nock from 'nock';

import cron from '../../src/cron/hashnodeBadge';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { ArticlePost, Source } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

const today = startOfToday();
const yesterday = startOfYesterday();

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, [
    ...sourcesFixture,
    {
      id: 'hashnode',
      name: 'Hashnode',
      image: 'https://hashnode.com',
      handle: 'hashnode',
    },
  ]);
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p1',
      shortId: 'sp1',
      title: 'P1',
      url: 'http://p1.com',
      sourceId: 'hashnode',
      createdAt: add(yesterday, { hours: 10 }),
      upvotes: 20,
    },
    {
      id: 'p2',
      shortId: 'sp2',
      title: 'P2',
      url: 'http://p2.com',
      sourceId: 'hashnode',
      createdAt: add(yesterday, { hours: 7 }),
      upvotes: 70,
    },
    {
      id: 'p3',
      shortId: 'sp3',
      title: 'P3',
      url: 'http://p3.com',
      sourceId: 'hashnode',
      createdAt: add(yesterday, { hours: 5 }),
      upvotes: 25,
    },
  ]);
});

it('should select the most upvoted post', async () => {
  nock('http://localhost:6000')
    .matchHeader('content-type', 'application/json')
    .post('/hashnode', { url: 'http://p2.com' })
    .reply(204);

  await expectSuccessfulCron(cron);
  expect(nock.isDone()).toEqual(true);
});

it('should select only an hashnode post', async () => {
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p4',
      shortId: 'sp4',
      title: 'P4',
      url: 'http://p4.com',
      sourceId: 'a',
      createdAt: add(yesterday, { hours: 15 }),
      upvotes: 100,
    },
  ]);

  nock('http://localhost:6000')
    .matchHeader('content-type', 'application/json')
    .post('/hashnode', { url: 'http://p2.com' })
    .reply(204);

  await expectSuccessfulCron(cron);
  expect(nock.isDone()).toEqual(true);
});

it('should select only a post from yesterday', async () => {
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p4',
      shortId: 'sp4',
      title: 'P4',
      url: 'http://p4.com',
      sourceId: 'a',
      createdAt: add(today, { hours: 1 }),
      upvotes: 100,
    },
  ]);

  nock('http://localhost:6000')
    .matchHeader('content-type', 'application/json')
    .post('/hashnode', { url: 'http://p2.com' })
    .reply(204);

  await expectSuccessfulCron(cron);
  expect(nock.isDone()).toEqual(true);
});

it('should select only a post from yesterday not before', async () => {
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p4',
      shortId: 'sp4',
      title: 'P4',
      url: 'http://p4.com',
      sourceId: 'a',
      createdAt: sub(yesterday, { hours: 15 }),
      upvotes: 100,
    },
  ]);

  nock('http://localhost:6000')
    .matchHeader('content-type', 'application/json')
    .post('/hashnode', { url: 'http://p2.com' })
    .reply(204);

  await expectSuccessfulCron(cron);
  expect(nock.isDone()).toEqual(true);
});
