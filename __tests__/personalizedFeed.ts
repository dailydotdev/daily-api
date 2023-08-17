import nock from 'nock';
import { deleteKeysByPattern, ioRedisPool } from '../src/redis';
import {
  generatePersonalizedFeed,
  getPersonalizedFeedKey,
  getPersonalizedFeedKeyPrefix,
} from '../src/personalizedFeed';
import {
  Feed,
  FeedSource,
  FeedTag,
  Source,
  SourceMember,
  User,
} from '../src/entity';
import { SourceMemberRoles } from '../src/roles';
import { saveFixtures } from './helpers';
import { sourcesFixture } from './fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';

let con: DataSource;

const feedResponse = {
  data: [
    { post_id: '1', metadata: { p: 'a' } },
    { post_id: '2', metadata: { p: 'b' } },
    { post_id: '3', metadata: { p: 'c' } },
    { post_id: '4' },
    { post_id: '5' },
    { post_id: '6' },
  ],
};

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await deleteKeysByPattern('feeds:*');
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, [usersFixture[0]]);
});

const setCache = (
  key: string,
  ids: string[] | [string, string | undefined][],
) =>
  ioRedisPool.execute(async (client) => {
    return client.set(`${key}:posts`, JSON.stringify(ids));
  });

it('should fetch anonymous feed and serve consequent pages from cache', async () => {
  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
      feed_id: 'global',
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual([
    ['1', JSON.stringify({ p: 'a' })],
    ['2', JSON.stringify({ p: 'b' })],
  ]);
  expect(nock.isDone()).toEqual(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const page1 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 2,
    feedVersion: 5,
  });
  expect(page1).toEqual([
    ['3', JSON.stringify({ p: 'c' })],
    ['4', null],
  ]);
});

it('should fetch anonymous feed and serve consequent calls from cache', async () => {
  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
      feed_id: 'global',
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  const expected = [
    ['1', JSON.stringify({ p: 'a' })],
    ['2', JSON.stringify({ p: 'b' })],
  ];
  expect(page0).toEqual(expected);
  expect(nock.isDone()).toEqual(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const page1 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page1).toEqual(expected);
});

it('should fetch anonymous feed even when cache is old', async () => {
  const key = getPersonalizedFeedKey();
  await ioRedisPool.execute(async (client) => {
    return client.set(
      `${key}:time`,
      new Date(new Date().getTime() - 60 * 60 * 1000).toISOString(),
    );
  });
  await setCache(key, ['7', '8']);

  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
      feed_id: 'global',
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual([
    ['1', JSON.stringify({ p: 'a' })],
    ['2', JSON.stringify({ p: 'b' })],
  ]);
  expect(nock.isDone()).toEqual(true);
});

it('should not fetch anonymous feed even when cache is still fresh', async () => {
  const key = getPersonalizedFeedKey();
  await ioRedisPool.execute(async (client) => {
    return client.set(`${key}:time`, new Date().toISOString());
  });
  await setCache(key, [
    ['7', JSON.stringify({ p: 'a' })],
    ['8', JSON.stringify({ p: 'b' })],
  ]);

  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual([
    ['7', JSON.stringify({ p: 'a' })],
    ['8', JSON.stringify({ p: 'b' })],
  ]);
  expect(nock.isDone()).toEqual(false);
});

it('should fetch anonymous feed when last updated time is greater than last generated time', async () => {
  const key = getPersonalizedFeedKey();
  await ioRedisPool.execute(async (client) => {
    return client.set(
      `${getPersonalizedFeedKeyPrefix()}:update`,
      new Date(new Date().getTime() - 10 * 1000).toISOString(),
    );
  });
  await ioRedisPool.execute(async (client) => {
    return client.set(
      `${key}:time`,
      new Date(new Date().getTime() - 60 * 1000).toISOString(),
    );
  });
  await setCache(key, ['7', '8']);

  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
      feed_id: 'global',
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual([
    ['1', JSON.stringify({ p: 'a' })],
    ['2', JSON.stringify({ p: 'b' })],
  ]);
  expect(nock.isDone()).toEqual(true);
});

it('should set the correct query parameters', async () => {
  await con.getRepository(Feed).save({ id: '1', userId: 'u1' });
  await con.getRepository(FeedTag).save([
    { feedId: '1', tag: 'javascript' },
    { feedId: '1', tag: 'golang' },
    { feedId: '1', tag: 'python', blocked: true },
    { feedId: '1', tag: 'java', blocked: true },
  ]);
  await con.getRepository(FeedSource).save([
    { feedId: '1', sourceId: 'a' },
    { feedId: '1', sourceId: 'b' },
  ]);
  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
      user_id: 'u1',
      feed_id: '1',
      allowed_tags: ['javascript', 'golang'],
      blocked_tags: ['python', 'java'],
      blocked_sources: ['a', 'b'],
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
    userId: 'u1',
    feedId: '1',
  });
  expect(page0).toEqual([
    ['1', JSON.stringify({ p: 'a' })],
    ['2', JSON.stringify({ p: 'b' })],
  ]);
  expect(nock.isDone()).toEqual(true);
});

it('should encode query parameters', async () => {
  await con.getRepository(Feed).save({ id: '1', userId: 'u1' });
  await con.getRepository(FeedTag).save([{ feedId: '1', tag: 'c#' }]);
  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
      user_id: 'u1',
      feed_id: '1',
      allowed_tags: ['c#'],
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
    userId: 'u1',
    feedId: '1',
  });
  expect(page0).toEqual([
    ['1', JSON.stringify({ p: 'a' })],
    ['2', JSON.stringify({ p: 'b' })],
  ]);
  expect(nock.isDone()).toEqual(true);
});

it('should send source memberships as parameter', async () => {
  await con.getRepository(Feed).save({ id: '1', userId: '1' });
  await con.getRepository(SourceMember).save([
    {
      userId: '1',
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      referralToken: 'rt',
    },
    {
      userId: '1',
      sourceId: 'b',
      role: SourceMemberRoles.Admin,
      referralToken: 'rt2',
    },
  ]);
  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
      user_id: '1',
      feed_id: '1',
      squad_ids: ['a', 'b'],
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
    userId: '1',
    feedId: '1',
  });
  expect(page0).toEqual([
    ['1', JSON.stringify({ p: 'a' })],
    ['2', JSON.stringify({ p: 'b' })],
  ]);
  expect(nock.isDone()).toEqual(true);
});

it('should support legacy cache format', async () => {
  const key = getPersonalizedFeedKey();
  await ioRedisPool.execute(async (client) => {
    return client.set(`${key}:time`, new Date().toISOString());
  });
  await setCache(key, ['7', '8']);

  nock('http://localhost:6000')
    .post('/feed.json', {
      total_pages: 40,
      page_size: 2,
      fresh_page_size: '1',
      feed_config_name: 'personalise',
    })
    .reply(200, feedResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual([
    ['7', undefined],
    ['8', undefined],
  ]);
  expect(nock.isDone()).toEqual(false);
});
