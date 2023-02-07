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
  SourceMemberRoles,
  User,
} from '../src/entity';
import { saveFixtures } from './helpers';
import { sourcesFixture } from './fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';

let con: DataSource;

const tinybirdResponse = {
  data: [
    { post_id: '1' },
    { post_id: '2' },
    { post_id: '3' },
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

const setCache = (key: string, ids: string[]) =>
  ioRedisPool.execute(async (client) => {
    return client.set(`${key}:posts`, JSON.stringify(ids));
  });

it('should fetch anonymous feed and serve consequent pages from cache', async () => {
  nock('http://localhost:6000')
    .get(
      '/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5&feed_id=global',
    )
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const page1 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 2,
    feedVersion: 5,
  });
  expect(page1).toEqual(['3', '4']);
});

it('should fetch anonymous feed and serve consequent calls from cache', async () => {
  nock('http://localhost:6000')
    .get(
      '/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5&feed_id=global',
    )
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const page1 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page1).toEqual(['1', '2']);
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
    .get(
      '/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5&feed_id=global',
    )
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
});

it('should not fetch anonymous feed even when cache is still fresh', async () => {
  const key = getPersonalizedFeedKey();
  await ioRedisPool.execute(async (client) => {
    return client.set(`${key}:time`, new Date().toISOString());
  });
  await setCache(key, ['7', '8']);

  nock('http://localhost:6000')
    .get('/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5')
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['7', '8']);
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
    .get(
      '/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5&feed_id=global',
    )
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['1', '2']);
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
    .get(
      '/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5&user_id=u1&feed_id=1&allowed_tags=javascript,golang&blocked_tags=python,java&blocked_sources=a,b',
    )
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
    userId: 'u1',
    feedId: '1',
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
});

it('should encode query parameters', async () => {
  await con.getRepository(Feed).save({ id: '1', userId: 'u1' });
  await con.getRepository(FeedTag).save([{ feedId: '1', tag: 'c#' }]);
  nock('http://localhost:6000')
    .get(
      '/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5&user_id=u1&feed_id=1&allowed_tags=c%23',
    )
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
    userId: 'u1',
    feedId: '1',
  });
  expect(page0).toEqual(['1', '2']);
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
      role: SourceMemberRoles.Owner,
      referralToken: 'rt2',
    },
  ]);
  nock('http://localhost:6000')
    .get(
      '/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5&user_id=1&feed_id=1&squad_ids=a,b',
    )
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
    userId: '1',
    feedId: '1',
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
});
