import { sub } from 'date-fns';

import cron from '../../src/cron/checkAnalyticsReport';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { ArticlePost, Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

const now = new Date();

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await con
    .getRepository(User)
    .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p1',
      shortId: 'sp1',
      title: 'P1',
      url: 'http://p1.com',
      sourceId: 'a',
      createdAt: sub(now, { hours: 10 }),
      authorId: '1',
      sentAnalyticsReport: false,
    },
    {
      id: 'p2',
      shortId: 'sp2',
      title: 'P2',
      url: 'http://p2.com',
      sourceId: 'a',
      createdAt: sub(now, { hours: 30 }),
      sentAnalyticsReport: false,
    },
    {
      id: 'p3',
      shortId: 'sp3',
      title: 'P3',
      url: 'http://p3.com',
      sourceId: 'a',
      createdAt: sub(now, { hours: 30 }),
      authorId: '1',
      sentAnalyticsReport: false,
    },
    {
      id: 'p4',
      shortId: 'sp4',
      title: 'P4',
      url: 'http://p4.com',
      sourceId: 'a',
      createdAt: sub(now, { hours: 40 }),
      authorId: '1',
      sentAnalyticsReport: false,
    },
    {
      id: 'p5',
      shortId: 'sp5',
      title: 'P5',
      url: 'http://p5.com',
      sourceId: 'a',
      createdAt: sub(now, { hours: 50 }),
      authorId: '1',
      sentAnalyticsReport: true,
    },
  ] as ArticlePost[]);
});

it('should publish message for every post that needs analytics report', async () => {
  await expectSuccessfulCron(cron);
  const posts = await con
    .getRepository(Post)
    .findBy({ sentAnalyticsReport: true });
  expect(posts.length).toEqual(5);
  expect(posts.map(({ id }) => id)).toEqual(
    expect.arrayContaining(['p3', 'p4', 'p5']),
  );
});
