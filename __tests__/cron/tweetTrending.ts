import { Connection, getConnection } from 'typeorm';
import { mocked } from 'ts-jest/utils';

import cron from '../../src/cron/tweetTrending';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { Post, Source } from '../../src/entity';
import { tweet } from '../../src/common';

let con: Connection;

jest.mock('../../src/common/twitter', () => ({
  ...(jest.requireActual('../../src/common/twitter') as Record<
    string,
    unknown
  >),
  tweet: jest.fn(),
}));

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(() => {
  mocked(tweet).mockClear();
});

it('should tweet the latest post over the views threshold', async () => {
  const now = new Date();
  await saveFixtures(con, Source, [
    { id: 'a', name: 'A', image: 'http://a.com' },
  ]);
  await saveFixtures(con, Post, [
    {
      id: 'p1',
      shortId: 'p1',
      title: 'P1',
      url: 'http://p1.com',
      score: 0,
      sourceId: 'a',
      createdAt: now,
    },
    {
      id: 'p2',
      shortId: 'p2',
      title: 'P2',
      url: 'http://p2.com',
      score: 0,
      sourceId: 'a',
      views: 2000,
      createdAt: new Date(now.getTime() - 1000),
    },
    {
      id: 'p3',
      shortId: 'p3',
      title: 'P3',
      url: 'http://p3.com',
      score: 0,
      sourceId: 'a',
      views: 3000,
      createdAt: new Date(now.getTime() - 2000),
    },
  ]);
  mocked(tweet).mockResolvedValue();
  await expectSuccessfulCron(cron);
  expect(tweet).toBeCalledTimes(1);
  expect(tweet).toBeCalledWith('P2\n\n\nhttp://localhost:5002/posts/p2');
  const post = await con.getRepository(Post).findOne('p2');
  expect(post.tweeted).toEqual(true);
});

it('should tag the author and site and add hashtags', async () => {
  await saveFixtures(con, Source, [
    { id: 'a', twitter: 'source', name: 'A', image: 'http://a.com' },
  ]);
  await saveFixtures(con, Post, [
    {
      id: 'p1',
      shortId: 'p1',
      title: 'P1',
      url: 'http://p1.com',
      score: 0,
      sourceId: 'a',
      createdAt: new Date(),
      views: 3000,
      siteTwitter: '@site',
      creatorTwitter: '@creator',
      tagsStr: 'webdev,javascript',
    },
  ]);
  mocked(tweet).mockResolvedValue();
  await expectSuccessfulCron(cron);
  expect(tweet).toBeCalledTimes(1);
  expect(tweet).toBeCalledWith(
    'P1 by @creator via @site\n#webdev #javascript\n\nhttp://localhost:5002/posts/p1',
  );
});

it('should fallback to source twitter', async () => {
  await saveFixtures(con, Source, [
    { id: 'a', twitter: 'source', name: 'A', image: 'http://a.com' },
  ]);
  await saveFixtures(con, Post, [
    {
      id: 'p1',
      shortId: 'p1',
      title: 'P1',
      url: 'http://p1.com',
      score: 0,
      sourceId: 'a',
      createdAt: new Date(),
      views: 3000,
      creatorTwitter: '@creator',
    },
  ]);
  mocked(tweet).mockResolvedValue();
  await expectSuccessfulCron(cron);
  expect(tweet).toBeCalledTimes(1);
  expect(tweet).toBeCalledWith(
    'P1 by @creator via @source\n\n\nhttp://localhost:5002/posts/p1',
  );
});
